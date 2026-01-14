import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { FileText, Plus, Calendar, CheckCircle2, Clock, AlertTriangle, CreditCard as Edit2, Trash2, Eye, ArrowRight, ChevronDown, Download, Filter, X, Search, CheckSquare, Square, MoreVertical, Upload, Paperclip } from 'lucide-react';
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
  responsible_department_ids?: string[];
  related_department_ids: string[];
  collaborating_departments_ids?: string[];
  special_responsible_types?: string[];
  related_special_responsible_types?: string[];
  all_units_responsible?: boolean;
  all_units_collaborating?: boolean;
  current_status_description?: string;
  condition_id: string;
  standard_id?: string;
  component_id?: string;
  action_plan_id: string;
  outputs?: string;
  expected_outputs?: string;
  is_continuous?: boolean;
  delay_days?: number;
  condition_code?: string;
  condition_description?: string;
  condition_provides_reasonable_assurance?: boolean;
  standard_code?: string;
  standard_name?: string;
  component_code?: string;
  component_name?: string;
  department_name?: string;
  related_departments?: string[];
  responsible_departments?: string[];
  collaborating_departments?: string[];
  responsible_special_units?: string[];
  collaborating_special_units?: string[];
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
  order_index?: number;
  component?: {
    order_index: number;
  };
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

const SPECIAL_UNITS = [
  { value: 'TOP_MANAGEMENT', label: 'Üst Yönetim' },
  { value: 'IC_MONITORING_BOARD', label: 'İç Kontrol İzleme ve Yönlendirme Kurulu' },
  { value: 'INTERNAL_AUDIT_BOARD', label: 'İç Denetim Kurulu' },
  { value: 'INTERNAL_AUDIT_COORDINATION_BOARD', label: 'İç Denetim Koordinasyon Kurulu' }
];

interface GeneralCondition {
  id: string;
  code: string;
  description: string;
  standard_id: string;
  provides_reasonable_assurance?: boolean;
  current_situation?: string;
}

export default function ICActions() {
  const { profile } = useAuth();
  const { navigate } = useLocation();

  const [actions, setActions] = useState<Action[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [generalConditions, setGeneralConditions] = useState<GeneralCondition[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [selectedStandardId, setSelectedStandardId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedResponsibleDeptId, setSelectedResponsibleDeptId] = useState<string>('');
  const [selectedCollaboratingDeptId, setSelectedCollaboratingDeptId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [sortColumn, setSortColumn] = useState<string>('delay');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set());

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
    description: '',
    attachment: null as File | null
  });

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    responsible_department_ids: [] as string[],
    related_department_ids: [] as string[],
    collaborating_departments_ids: [] as string[],
    special_responsible_types: [] as string[],
    related_special_responsible_types: [] as string[],
    all_units_responsible: false,
    all_units_collaborating: false,
    outputs: '',
    expected_outputs: '',
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

  useEffect(() => {
    if (selectedPlanId) {
      loadActions();
    }
  }, [selectedPlanId]);

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
      .order('order_index');

    if (error) throw error;
    setComponents(data || []);
  };

  const loadStandards = async () => {
    const { data, error } = await supabase
      .from('ic_standards')
      .select(`
        *,
        component:ic_components!component_id(order_index)
      `);

    if (error) throw error;

    const sortedData = (data || []).sort((a, b) => {
      const componentOrderA = a.component?.order_index || 999;
      const componentOrderB = b.component?.order_index || 999;

      if (componentOrderA !== componentOrderB) {
        return componentOrderA - componentOrderB;
      }

      return (a.order_index || 999) - (b.order_index || 999);
    });

    setStandards(sortedData);
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

    setLoading(true);
    try {
      const { data: actionsData, error } = await supabase
        .from('ic_actions')
        .select(`
          *,
          ic_general_conditions!ic_actions_condition_id_fkey (
            code,
            description,
            standard_id,
            provides_reasonable_assurance
          ),
          departments!ic_actions_responsible_department_id_fkey (
            name
          )
        `)
        .eq('action_plan_id', selectedPlanId);

      if (error) throw error;

      const actionConditionIds = new Set((actionsData || []).map(a => a.condition_id).filter(Boolean));
      const assessmentsMap = new Map<string, string>();

      const { data: allAssessmentsData } = await supabase
        .from('ic_condition_assessments')
        .select('condition_id, current_situation')
        .eq('action_plan_id', selectedPlanId)
        .neq('current_situation', '')
        .not('current_situation', 'is', null);

      const conditionsWithoutActions: string[] = [];

      if (allAssessmentsData) {
        allAssessmentsData.forEach(a => {
          if (a.current_situation) {
            assessmentsMap.set(a.condition_id, a.current_situation);

            if (!actionConditionIds.has(a.condition_id)) {
              conditionsWithoutActions.push(a.condition_id);
            }
          }
        });
      }

      const enrichedActions = await Promise.all((actionsData || []).map(async (action) => {
        const condition = action.ic_general_conditions;
        let standard = null;
        let component = null;
        const standardId = condition?.standard_id;

        if (standardId) {
          const { data: standardData } = await supabase
            .from('ic_standards')
            .select('code, name, component_id')
            .eq('id', standardId)
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

        const responsibleDepts: string[] = [];
        if (action.responsible_department_ids && action.responsible_department_ids.length > 0) {
          const { data: depts } = await supabase
            .from('departments')
            .select('name')
            .in('id', action.responsible_department_ids);

          if (depts) {
            responsibleDepts.push(...depts.map(d => d.name));
          }
        }

        const collaboratingDepts: string[] = [];
        if (action.collaborating_departments_ids && action.collaborating_departments_ids.length > 0) {
          const { data: depts } = await supabase
            .from('departments')
            .select('name')
            .in('id', action.collaborating_departments_ids);

          if (depts) {
            collaboratingDepts.push(...depts.map(d => d.name));
          }
        }

        const responsibleSpecialUnits: string[] = [];
        if (action.special_responsible_types && action.special_responsible_types.length > 0) {
          responsibleSpecialUnits.push(...action.special_responsible_types.map(type => {
            const unit = SPECIAL_UNITS.find(u => u.value === type);
            return unit?.label || type;
          }));
        }

        const collaboratingSpecialUnits: string[] = [];
        if (action.related_special_responsible_types && action.related_special_responsible_types.length > 0) {
          collaboratingSpecialUnits.push(...action.related_special_responsible_types.map(type => {
            const unit = SPECIAL_UNITS.find(u => u.value === type);
            return unit?.label || type;
          }));
        }

        const delayDays = action.target_date &&
          new Date(action.target_date) < new Date() &&
          !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(action.status)
            ? Math.floor((new Date().getTime() - new Date(action.target_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        const currentStatusDescription = assessmentsMap.get(action.condition_id) || '';

        return {
          ...action,
          condition_code: condition?.code,
          condition_description: condition?.description,
          condition_provides_reasonable_assurance: condition?.provides_reasonable_assurance,
          standard_id: standardId,
          standard_code: standard?.code,
          standard_name: standard?.name,
          component_id: standard?.component_id,
          component_code: component?.code,
          component_name: component?.name,
          department_name: action.departments?.name,
          related_departments: relatedDepts,
          responsible_departments: responsibleDepts,
          collaborating_departments: collaboratingDepts,
          responsible_special_units: responsibleSpecialUnits,
          collaborating_special_units: collaboratingSpecialUnits,
          current_status_description: currentStatusDescription,
          delay_days: delayDays
        };
      }));

      const conditionsWithoutActionsData = await Promise.all(
        conditionsWithoutActions.map(async (conditionId) => {
          const { data: conditionData } = await supabase
            .from('ic_general_conditions')
            .select('code, description, standard_id, provides_reasonable_assurance')
            .eq('id', conditionId)
            .single();

          if (!conditionData) return null;

          let standard = null;
          let component = null;

          if (conditionData.standard_id) {
            const { data: standardData } = await supabase
              .from('ic_standards')
              .select('code, name, component_id')
              .eq('id', conditionData.standard_id)
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

          return {
            id: `no-action-${conditionId}`,
            code: conditionData.code,
            title: 'Makul güvenceyi sağlayan mevcut düzenleme ve uygulamalar bulunduğundan eylem öngörülmemiştir.',
            description: '',
            status: 'NO_ACTION',
            progress_percent: 0,
            target_date: '',
            start_date: '',
            responsible_department_id: '',
            responsible_department_ids: [],
            related_department_ids: [],
            collaborating_departments_ids: [],
            special_responsible_types: [],
            related_special_responsible_types: [],
            all_units_responsible: false,
            all_units_collaborating: false,
            condition_id: conditionId,
            standard_id: conditionData.standard_id,
            component_id: standard?.component_id,
            action_plan_id: selectedPlanId,
            outputs: '',
            expected_outputs: '',
            is_continuous: false,
            delay_days: 0,
            condition_code: conditionData.code,
            condition_description: conditionData.description,
            condition_provides_reasonable_assurance: conditionData.provides_reasonable_assurance,
            standard_code: standard?.code,
            standard_name: standard?.name,
            component_code: component?.code,
            component_name: component?.name,
            department_name: '',
            related_departments: [],
            responsible_departments: [],
            collaborating_departments: [],
            responsible_special_units: [],
            collaborating_special_units: [],
            current_status_description: assessmentsMap.get(conditionId) || ''
          };
        })
      );

      const validConditionsWithoutActions = conditionsWithoutActionsData.filter(
        (item): item is Action => item !== null
      );

      const allActionsAndConditions = [...enrichedActions, ...validConditionsWithoutActions];

      allActionsAndConditions.sort((a, b) => {
        const codeA = a.condition_code || '';
        const codeB = b.condition_code || '';

        const partsA = codeA.split(/[\s.]+/);
        const partsB = codeB.split(/[\s.]+/);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const partA = partsA[i] || '';
          const partB = partsB[i] || '';

          const numA = parseInt(partA);
          const numB = parseInt(partB);

          if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
          } else {
            if (partA !== partB) return partA.localeCompare(partB);
          }
        }

        return 0;
      });

      setActions(allActionsAndConditions);

      const { data: conditionsData } = await supabase
        .from('ic_general_conditions')
        .select('id, code, description, standard_id, provides_reasonable_assurance')
        .eq('action_plan_id', selectedPlanId);

      if (conditionsData) {
        const conditionsWithStatus = await Promise.all(
          conditionsData.map(async (condition) => {
            const { data: assessment } = await supabase
              .from('ic_condition_assessments')
              .select('current_situation')
              .eq('condition_id', condition.id)
              .eq('action_plan_id', selectedPlanId)
              .maybeSingle();

            return {
              ...condition,
              current_situation: assessment?.current_situation || ''
            };
          })
        );

        setGeneralConditions(conditionsWithStatus);
      }
    } catch (error) {
      console.error('Eylemler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStandards = useMemo(() => {
    if (!selectedComponentId) return standards;
    return standards.filter(s => s.component_id === selectedComponentId);
  }, [selectedComponentId, standards]);

  const baseFilteredActions = useMemo(() => {
    let filtered = actions;

    if (selectedComponentId) {
      filtered = filtered.filter(a => a.component_id === selectedComponentId);
    }

    if (selectedStandardId) {
      filtered = filtered.filter(a => a.standard_id === selectedStandardId);
    }

    if (selectedDepartmentId) {
      filtered = filtered.filter(a => a.responsible_department_id === selectedDepartmentId);
    }

    if (selectedResponsibleDeptId) {
      filtered = filtered.filter(a =>
        a.responsible_department_ids?.includes(selectedResponsibleDeptId)
      );
    }

    if (selectedCollaboratingDeptId) {
      filtered = filtered.filter(a =>
        a.collaborating_departments_ids?.includes(selectedCollaboratingDeptId)
      );
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
  }, [actions, selectedComponentId, selectedStandardId, selectedDepartmentId, selectedResponsibleDeptId, selectedCollaboratingDeptId, searchTerm]);

  const filteredActions = useMemo(() => {
    let filtered = baseFilteredActions;

    if (selectedStatus) {
      if (selectedStatus === 'DELAYED') {
        filtered = filtered.filter(a =>
          a.delay_days && a.delay_days > 0 && !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(a.status)
        );
      } else if (selectedStatus === 'CONTINUOUS') {
        filtered = filtered.filter(a => a.is_continuous === true);
      } else {
        filtered = filtered.filter(a => a.status === selectedStatus);
      }
    }

    return filtered;
  }, [baseFilteredActions, selectedStatus]);

  const compareComponentCodes = useCallback((codeA: string, codeB: string): number => {
    const componentOrder = ['KOS', 'RDS', 'KFS', 'BIS', 'IS'];

    const cleanA = codeA.trim().toUpperCase();
    const cleanB = codeB.trim().toUpperCase();

    const indexA = componentOrder.indexOf(cleanA);
    const indexB = componentOrder.indexOf(cleanB);

    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return codeA.localeCompare(codeB, 'tr');
  }, []);

  const sortedActions = useMemo(() => {
    const sorted = [...filteredActions];

    sorted.sort((a, b) => {
      const componentCompare = compareComponentCodes(a.component_code || '', b.component_code || '');
      if (componentCompare !== 0) return componentCompare;

      const standardCompare = (a.standard_code || '').localeCompare(b.standard_code || '', undefined, { numeric: true, sensitivity: 'base' });
      if (standardCompare !== 0) return standardCompare;

      const conditionCompare = (a.condition_code || '').localeCompare(b.condition_code || '', undefined, { numeric: true, sensitivity: 'base' });
      if (conditionCompare !== 0) return conditionCompare;

      if (a.status === 'NO_ACTION' && b.status !== 'NO_ACTION') return -1;
      if (a.status !== 'NO_ACTION' && b.status === 'NO_ACTION') return 1;

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
          ? a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
          : b.code.localeCompare(a.code, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (sortColumn === 'standard') {
        const aStd = a.standard_code || '';
        const bStd = b.standard_code || '';
        return sortDirection === 'asc'
          ? aStd.localeCompare(bStd, undefined, { numeric: true, sensitivity: 'base' })
          : bStd.localeCompare(aStd, undefined, { numeric: true, sensitivity: 'base' });
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

      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    });

    return sorted;
  }, [filteredActions, sortColumn, sortDirection]);

  const hierarchicalData = useMemo(() => {
    const componentMap = new Map<string, {
      component: { id: string; code: string; name: string };
      standards: Map<string, {
        standard: { id: string; code: string; name: string };
        conditions: Map<string, {
          condition: { id: string; code: string; description: string };
          actions: Action[];
        }>;
      }>;
    }>();

    sortedActions.forEach(action => {
      const compKey = action.component_code || 'other';
      const compId = action.component_id || 'other';
      const compName = action.component_name || 'Diğer';

      if (!componentMap.has(compKey)) {
        componentMap.set(compKey, {
          component: { id: compId, code: compKey, name: compName },
          standards: new Map()
        });
      }

      const compData = componentMap.get(compKey)!;
      const stdKey = action.standard_code || 'other';
      const stdId = action.standard_id || 'other';
      const stdName = action.standard_name || 'Diğer';

      if (!compData.standards.has(stdKey)) {
        compData.standards.set(stdKey, {
          standard: { id: stdId, code: stdKey, name: stdName },
          conditions: new Map()
        });
      }

      const stdData = compData.standards.get(stdKey)!;
      const condKey = action.condition_code || 'other';
      const condId = action.condition_id || 'other';
      const condDesc = action.condition_description || 'Açıklama yok';

      if (!stdData.conditions.has(condKey)) {
        stdData.conditions.set(condKey, {
          condition: { id: condId, code: condKey, description: condDesc },
          actions: []
        });
      }

      stdData.conditions.get(condKey)!.actions.push(action);
    });

    return Array.from(componentMap.values())
      .sort((a, b) => compareComponentCodes(a.component.code, b.component.code));
  }, [sortedActions, compareComponentCodes]);

  useEffect(() => {
    if (hierarchicalData.length > 0) {
      const allComponents = new Set<string>();
      const allStandards = new Set<string>();
      const allConditions = new Set<string>();

      hierarchicalData.forEach(compData => {
        const compKey = compData.component.code;
        allComponents.add(compKey);

        Array.from(compData.standards.values()).forEach(stdData => {
          const stdKey = `${compKey}-${stdData.standard.code}`;
          allStandards.add(stdKey);

          Array.from(stdData.conditions.values()).forEach(condData => {
            const condKey = `${stdKey}-${condData.condition.code}`;
            allConditions.add(condKey);
          });
        });
      });

      setExpandedComponents(allComponents);
      setExpandedStandards(allStandards);
      setExpandedConditions(allConditions);
    }
  }, [hierarchicalData]);

  const paginatedActions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedActions.slice(start, end);
  }, [sortedActions, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedActions.length / pageSize);

  const stats = useMemo(() => {
    const actualActions = baseFilteredActions.filter(a => a.status !== 'NO_ACTION');
    const noActions = baseFilteredActions.filter(a => a.status === 'NO_ACTION').length;

    const total = actualActions.length;
    const completed = actualActions.filter(a => a.status === 'COMPLETED').length;
    const inProgress = actualActions.filter(a => a.status === 'IN_PROGRESS').length;
    const notStarted = actualActions.filter(a => a.status === 'NOT_STARTED').length;
    const delayed = actualActions.filter(a =>
      a.delay_days && a.delay_days > 0 && !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(a.status)
    ).length;
    const ongoing = actualActions.filter(a => a.status === 'ONGOING').length;
    const continuousActions = actualActions.filter(a => a.is_continuous === true).length;

    return {
      total,
      noActions,
      completed,
      completedPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      inProgress,
      inProgressPercent: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      notStarted,
      notStartedPercent: total > 0 ? Math.round((notStarted / total) * 100) : 0,
      delayed,
      delayedPercent: total > 0 ? Math.round((delayed / total) * 100) : 0,
      ongoing,
      ongoingPercent: total > 0 ? Math.round((ongoing / total) * 100) : 0,
      continuousActions
    };
  }, [baseFilteredActions]);

  const componentStats = useMemo(() => {
    const componentMap = new Map<string, {
      id: string;
      code: string;
      name: string;
      standards: Set<string>;
      conditions: Set<string>;
      conditionsWithReasonableAssurance: number;
      actions: any[];
    }>();

    actions.forEach(action => {
      if (!action.component_id || !action.component_code || !action.component_name) return;

      if (!componentMap.has(action.component_id)) {
        componentMap.set(action.component_id, {
          id: action.component_id,
          code: action.component_code,
          name: action.component_name,
          standards: new Set(),
          conditions: new Set(),
          conditionsWithReasonableAssurance: 0,
          actions: []
        });
      }

      const comp = componentMap.get(action.component_id)!;

      if (action.standard_id) {
        comp.standards.add(action.standard_id);
      }

      if (action.condition_id) {
        comp.conditions.add(action.condition_id);

        if (action.status === 'NO_ACTION' && action.condition_provides_reasonable_assurance) {
          comp.conditionsWithReasonableAssurance++;
        }
      }

      if (action.status !== 'NO_ACTION') {
        comp.actions.push(action);
      }
    });

    return Array.from(componentMap.values()).map(comp => {
      const actionList = comp.actions;
      const continuousCount = actionList.filter(a => a.is_continuous === true).length;
      const notStartedCount = actionList.filter(a => a.is_continuous !== true && a.status === 'NOT_STARTED').length;
      const ongoingCount = actionList.filter(a => a.is_continuous !== true && a.status === 'IN_PROGRESS').length;
      const delayedCount = actionList.filter(a =>
        a.is_continuous !== true &&
        a.delay_days && a.delay_days > 0 && !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(a.status)
      ).length;

      return {
        id: comp.id,
        code: comp.code,
        name: comp.name,
        standardCount: comp.standards.size,
        conditionCount: comp.conditions.size,
        conditionsWithReasonableAssurance: comp.conditionsWithReasonableAssurance,
        actionCount: actionList.length,
        continuousCount,
        notStartedCount,
        ongoingCount,
        delayedCount
      };
    }).sort((a, b) => {
      const codeA = a.code.match(/KİKS-(\d+)/)?.[1] || '0';
      const codeB = b.code.match(/KİKS-(\d+)/)?.[1] || '0';
      return parseInt(codeA) - parseInt(codeB);
    });
  }, [actions]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleComponent = (componentKey: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (next.has(componentKey)) {
        next.delete(componentKey);
      } else {
        next.add(componentKey);
      }
      return next;
    });
  };

  const toggleStandard = (standardKey: string) => {
    setExpandedStandards(prev => {
      const next = new Set(prev);
      if (next.has(standardKey)) {
        next.delete(standardKey);
      } else {
        next.add(standardKey);
      }
      return next;
    });
  };

  const toggleCondition = (conditionKey: string) => {
    setExpandedConditions(prev => {
      const next = new Set(prev);
      if (next.has(conditionKey)) {
        next.delete(conditionKey);
      } else {
        next.add(conditionKey);
      }
      return next;
    });
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(selectedStatus === status ? '' : status);
  };

  const handleComponentFilter = (componentId: string) => {
    setSelectedComponentId(selectedComponentId === componentId ? '' : componentId);
  };

  const clearFilters = () => {
    setSelectedComponentId('');
    setSelectedStandardId('');
    setSelectedDepartmentId('');
    setSelectedResponsibleDeptId('');
    setSelectedCollaboratingDeptId('');
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

  const handleEdit = async (action: Action) => {
    setSelectedAction(action);

    const { data: actionData } = await supabase
      .from('ic_actions')
      .select('*')
      .eq('id', action.id)
      .single();

    setEditForm({
      title: actionData?.title || action.title,
      description: actionData?.description || '',
      responsible_department_ids: actionData?.responsible_department_ids || [],
      related_department_ids: actionData?.related_department_ids || [],
      collaborating_departments_ids: actionData?.collaborating_departments_ids || [],
      special_responsible_types: actionData?.special_responsible_types || [],
      related_special_responsible_types: actionData?.related_special_responsible_types || [],
      all_units_responsible: actionData?.all_units_responsible || false,
      all_units_collaborating: actionData?.all_units_collaborating || false,
      outputs: actionData?.outputs || '',
      expected_outputs: actionData?.expected_outputs || '',
      is_continuous: actionData?.is_continuous || false,
      start_date: actionData?.start_date || '',
      target_date: actionData?.target_date || '',
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
      let documentId: string | null = null;

      if (progressForm.attachment) {
        const fileExt = progressForm.attachment.name.split('.').pop();
        const fileName = `${selectedAction.id}/progress/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ic-action-documents')
          .upload(fileName, progressForm.attachment);

        if (uploadError) throw uploadError;

        const { data: docData, error: docError } = await supabase
          .from('ic_action_documents')
          .insert({
            action_id: selectedAction.id,
            name: progressForm.attachment.name,
            file_url: fileName,
            file_size: progressForm.attachment.size,
            file_type: progressForm.attachment.type || 'application/octet-stream',
            uploaded_by_id: profile?.id,
            document_type: 'progress'
          })
          .select('id')
          .single();

        if (docError) throw docError;
        documentId = docData?.id;
      }

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

      alert('İlerleme başarıyla güncellendi' + (documentId ? ' ve evrak yüklendi' : ''));
      setShowProgressModal(false);
      setProgressForm({
        new_progress: 0,
        new_status: '',
        completed_date: '',
        description: '',
        attachment: null
      });
      loadActions();
    } catch (error) {
      console.error('İlerleme güncellenirken hata:', error);
      alert('İlerleme güncellenirken bir hata oluştu');
    }
  };

  const submitEdit = async () => {
    if (!selectedAction) return;

    if (!editForm.title.trim()) {
      alert('Eylem açıklaması zorunludur');
      return;
    }

    if (!editForm.all_units_responsible &&
        editForm.responsible_department_ids.length === 0 &&
        editForm.special_responsible_types.length === 0) {
      alert('En az bir sorumlu birim seçmelisiniz veya "Tüm Birimler Sorumlu" seçeneğini işaretlemelisiniz');
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_actions')
        .update({
          title: editForm.title,
          description: editForm.description,
          responsible_department_ids: editForm.responsible_department_ids,
          special_responsible_types: editForm.special_responsible_types,
          all_units_responsible: editForm.all_units_responsible,
          collaborating_departments_ids: editForm.collaborating_departments_ids,
          related_special_responsible_types: editForm.related_special_responsible_types,
          all_units_collaborating: editForm.all_units_collaborating,
          related_department_ids: editForm.related_department_ids,
          outputs: editForm.outputs,
          expected_outputs: editForm.expected_outputs,
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

  const handleDeleteProgressEntry = async (entryId: string) => {
    if (!confirm('Bu ilerleme kaydını silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_action_progress')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      alert('İlerleme kaydı başarıyla silindi');
      if (selectedAction) {
        await loadProgressHistory(selectedAction.id);
      }
    } catch (error) {
      console.error('İlerleme kaydı silinirken hata:', error);
      alert('İlerleme kaydı silinirken bir hata oluştu');
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
    const rows: any[][] = [];

    rows.push([
      'Standart Kod No',
      'Kamu İç Kontrol Standardı ve Genel Şartı',
      'Mevcut Durum',
      'Eylem Kod No',
      'Öngörülen Eylemler',
      'Sorumlu Birimler',
      'İşbirliği Yapılacak Birim',
      'Çıktı/Sonuç',
      'Tamamlanma Tarihi',
      'Durum ve İlerleme'
    ]);

    hierarchicalData.forEach(componentData => {
      rows.push([componentData.component.name.toUpperCase(), '', '', '', '', '', '', '', '', '']);

      Array.from(componentData.standards.values())
        .sort((a, b) => a.standard.code.localeCompare(b.standard.code, undefined, { numeric: true }))
        .forEach(standardData => {
          rows.push([`${standardData.standard.code} - ${standardData.standard.name}`, '', '', '', '', '', '', '', '', '']);

          Array.from(standardData.conditions.values())
            .sort((a, b) => a.condition.code.localeCompare(b.condition.code, undefined, { numeric: true }))
            .forEach(conditionData => {
              const actions = conditionData.actions;

              actions.forEach((action, actionIndex) => {
                const responsibleUnits = action.status === 'NO_ACTION'
                  ? '-'
                  : action.all_units_responsible
                    ? 'Tüm Birimler'
                    : [
                        ...(action.responsible_special_units || []),
                        ...(action.responsible_departments || [])
                      ].join(', ') || '-';

                const collaboratingUnits = action.status === 'NO_ACTION'
                  ? '-'
                  : action.all_units_collaborating
                    ? 'Tüm Birimler'
                    : [
                        ...(action.collaborating_special_units || []),
                        ...(action.collaborating_departments || [])
                      ].join(', ') || '-';

                const row = [
                  actionIndex === 0 ? conditionData.condition.code : '',
                  actionIndex === 0 ? `${conditionData.condition.code} - ${conditionData.condition.description}` : '',
                  actionIndex === 0 ? (action.current_status_description || '-') : '',
                  action.status === 'NO_ACTION' ? '' : action.code,
                  action.status === 'NO_ACTION' ? 'Eylem Oluşturulmamış' : action.title,
                  responsibleUnits,
                  collaboratingUnits,
                  action.status === 'NO_ACTION' ? '-' : (action.expected_outputs || action.outputs || '-'),
                  action.status === 'NO_ACTION' ? '-' : (
                    action.is_continuous
                      ? 'Sürekli'
                      : action.completed_date
                        ? new Date(action.completed_date).toLocaleDateString('tr-TR')
                        : action.target_date
                          ? new Date(action.target_date).toLocaleDateString('tr-TR')
                          : '-'
                  ),
                  action.status === 'NO_ACTION' ? '-' : `${getStatusLabel(action.status)} - %${action.progress_percent}`
                ];

                rows.push(row);
              });
            });
        });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
      { wch: 12 },
      { wch: 40 },
      { wch: 35 },
      { wch: 12 },
      { wch: 40 },
      { wch: 25 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'İç Kontrol Eylemleri');
    XLSX.writeFile(wb, `ic-eylemler-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Ic Kontrol Eylemleri', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);

    const selectedPlan = actionPlans.find(p => p.id === selectedPlanId);
    if (selectedPlan) {
      doc.text(`Eylem Plani: ${selectedPlan.name}`, 14, 27);
    }

    doc.text(`Toplam: ${stats.total} | Tamamlanan: ${stats.completed} (%${stats.completedPercent}) | Devam Eden: ${stats.inProgress} (%${stats.inProgressPercent}) | Surekli: ${stats.continuousActions} | Geciken: ${stats.delayed} (%${stats.delayedPercent}) | Eylem Yok: ${stats.noActions}`, 14, 32);

    const tableData: any[] = [];

    hierarchicalData.forEach(componentData => {
      tableData.push({
        content: componentData.component.name.toUpperCase(),
        colSpan: 10,
        styles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 }
      });

      Array.from(componentData.standards.values())
        .sort((a, b) => a.standard.code.localeCompare(b.standard.code, undefined, { numeric: true }))
        .forEach(standardData => {
          tableData.push({
            content: `${standardData.standard.code} - ${standardData.standard.name}`,
            colSpan: 10,
            styles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', halign: 'left', fontSize: 7 }
          });

          Array.from(standardData.conditions.values())
            .sort((a, b) => a.condition.code.localeCompare(b.condition.code, undefined, { numeric: true }))
            .forEach(conditionData => {
              const actions = conditionData.actions;

              actions.forEach((action, actionIndex) => {
                const responsibleUnits = action.status === 'NO_ACTION'
                  ? '-'
                  : action.all_units_responsible
                    ? 'Tum Birimler'
                    : [
                        ...(action.responsible_special_units || []),
                        ...(action.responsible_departments || [])
                      ].slice(0, 2).join(', ') || '-';

                const collaboratingUnits = action.status === 'NO_ACTION'
                  ? '-'
                  : action.all_units_collaborating
                    ? 'Tum Birimler'
                    : [
                        ...(action.collaborating_special_units || []),
                        ...(action.collaborating_departments || [])
                      ].slice(0, 2).join(', ') || '-';

                const actionTitle = action.status === 'NO_ACTION'
                  ? 'Eylem Olusturulmamis'
                  : (action.title.length > 40 ? action.title.substring(0, 37) + '...' : action.title);

                const row = [
                  actionIndex === 0 ? conditionData.condition.code : '',
                  actionIndex === 0 ? `${conditionData.condition.code} - ${conditionData.condition.description.substring(0, 50)}${conditionData.condition.description.length > 50 ? '...' : ''}` : '',
                  actionIndex === 0 ? (action.current_status_description?.substring(0, 40) || '-') : '',
                  action.status === 'NO_ACTION' ? '' : action.code,
                  actionTitle,
                  responsibleUnits,
                  collaboratingUnits,
                  action.status === 'NO_ACTION' ? '-' : (
                    action.expected_outputs?.substring(0, 30) || action.outputs?.substring(0, 30) || '-'
                  ),
                  action.status === 'NO_ACTION' ? '-' : (
                    action.is_continuous
                      ? 'Surekli'
                      : action.completed_date
                        ? new Date(action.completed_date).toLocaleDateString('tr-TR')
                        : action.target_date
                          ? new Date(action.target_date).toLocaleDateString('tr-TR')
                          : '-'
                  ),
                  action.status === 'NO_ACTION' ? '-' : `${getStatusLabel(action.status, true)} %${action.progress_percent}`
                ];

                tableData.push(row);
              });
            });
        });
    });

    autoTable(doc, {
      startY: 37,
      head: [[
        'Standart\nKod No',
        'Kamu Ic Kontrol\nStandardi ve Genel Sarti',
        'Mevcut\nDurum',
        'Eylem\nKod No',
        'Ongorulen\nEylemler',
        'Sorumlu\nBirimler',
        'Isbirligi\nYapilacak Birim',
        'Cikti/\nSonuc',
        'Tamamlanma\nTarihi',
        'Durum ve\nIlerleme'
      ]],
      body: tableData,
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        font: 'helvetica',
        fontStyle: 'normal',
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [156, 163, 175],
        fontStyle: 'bold',
        fontSize: 6,
        halign: 'center',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', valign: 'top' },
        1: { cellWidth: 45, valign: 'top' },
        2: { cellWidth: 35, valign: 'top' },
        3: { cellWidth: 12, halign: 'center', valign: 'top' },
        4: { cellWidth: 45, valign: 'top' },
        5: { cellWidth: 25, valign: 'top' },
        6: { cellWidth: 25, valign: 'top' },
        7: { cellWidth: 30, valign: 'top' },
        8: { cellWidth: 18, halign: 'center', valign: 'top' },
        9: { cellWidth: 28, valign: 'top' }
      },
      didParseCell: (data) => {
        if (data.row.index > 0 && data.cell.raw && typeof data.cell.raw === 'object' && 'colSpan' in data.cell.raw) {
          data.cell.styles.cellPadding = 2;
        }
      }
    });

    doc.save(`ic-eylemler-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStatusLabel = (status: string, forPDF: boolean = false) => {
    if (forPDF) {
      const pdfLabels: Record<string, string> = {
        'NOT_STARTED': 'Baslamadi',
        'IN_PROGRESS': 'Devam Ediyor',
        'COMPLETED': 'Tamamlandi',
        'DELAYED': 'Gecikmis',
        'CANCELLED': 'Iptal',
        'ONGOING': 'Surekli',
        'NO_ACTION': 'Eylem Yok'
      };
      return pdfLabels[status] || status;
    }

    const labels: Record<string, string> = {
      'NOT_STARTED': 'Başlamadı',
      'IN_PROGRESS': 'Devam Ediyor',
      'COMPLETED': 'Tamamlandı',
      'DELAYED': 'Gecikmiş',
      'CANCELLED': 'İptal',
      'ONGOING': 'Sürekli',
      'NO_ACTION': 'Eylem Yok'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (action: Action) => {
    if (action.status === 'NO_ACTION') {
      return 'bg-amber-100 text-amber-800';
    }
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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

        <button
          onClick={() => handleStatusFilter('NO_ACTION')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === 'NO_ACTION' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-green-600">{stats.noActions}</div>
          <div className="text-sm text-gray-600 mt-1">MEVCUT DURUM</div>
          <div className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Sağlanıyor
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('CONTINUOUS')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === 'CONTINUOUS' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-teal-600">{stats.continuousActions}</div>
          <div className="text-sm text-gray-600 mt-1">SÜREKLİ</div>
          <div className="text-xs text-teal-600 mt-1 flex items-center justify-center gap-1">
            <ArrowRight className="w-3 h-3" />
            Eylemler
          </div>
        </button>
      </div>

      {componentStats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Bileşen Bazlı Özet</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {componentStats.map(comp => (
              <button
                key={comp.id}
                onClick={() => handleComponentFilter(comp.id)}
                className={`bg-white border-2 rounded-lg p-4 hover:border-blue-400 transition-all text-left ${
                  selectedComponentId === comp.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="font-bold text-sm text-gray-900 mb-3" title={comp.name}>
                  {comp.name}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{comp.standardCount} Standart</span>
                  </div>

                  <div>
                    <span className="text-gray-600">{comp.conditionCount} Genel Şart</span>
                    {comp.conditionsWithReasonableAssurance > 0 && (
                      <span className="text-green-600 font-medium">
                        {' '}({comp.conditionsWithReasonableAssurance} Mevcut Durum Sağlanıyor)
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-900 font-medium">{comp.actionCount} Eylem</span>
                    </div>
                    {(comp.continuousCount > 0 || comp.notStartedCount > 0 || comp.ongoingCount > 0 || comp.delayedCount > 0) && (
                      <div className="flex flex-wrap gap-1 text-xs">
                        {comp.continuousCount > 0 && (
                          <span className="text-blue-600">({comp.continuousCount} Sürekli</span>
                        )}
                        {comp.notStartedCount > 0 && (
                          <span className="text-orange-600">{comp.notStartedCount} Başlamadı</span>
                        )}
                        {comp.ongoingCount > 0 && (
                          <span className="text-teal-600">{comp.ongoingCount} Devam Ediyor</span>
                        )}
                        {comp.delayedCount > 0 && (
                          <span className="text-red-600">{comp.delayedCount} Geciken)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              value={selectedResponsibleDeptId}
              onChange={(e) => setSelectedResponsibleDeptId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Sorumlu Birimler</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>

            <select
              value={selectedCollaboratingDeptId}
              onChange={(e) => setSelectedCollaboratingDeptId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm İşbirliği Birimleri</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <select
              value={selectedStatus}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Durumlar</option>
              <option value="NOT_STARTED">Başlamadı</option>
              <option value="IN_PROGRESS">Devam Ediyor</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="DELAYED">Geciken</option>
              <option value="CONTINUOUS">Sürekli</option>
              <option value="ONGOING">Sürekli (ONGOING)</option>
              <option value="NO_ACTION">Mevcut Durum Sağlanıyor</option>
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      ) : hierarchicalData.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Eylem bulunamadı.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                  Standart Kod No
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[200px]">
                  Kamu İç Kontrol Standardı ve Genel Şartı
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[200px]">
                  Mevcut Durum
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                  Eylem Kod No
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[200px]">
                  Öngörülen Eylemler
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[150px]">
                  Sorumlu Birimler
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[150px]">
                  İşbirliği Yapılacak Birim
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[200px]">
                  Çıktı/Sonuç
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                  Tamamlanma Tarihi
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 min-w-[200px]">
                  Açıklama
                </th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {hierarchicalData.map(componentData => (
                <>
                  <tr key={`comp-${componentData.component.code}`}>
                    <td colSpan={11} className="border border-gray-300 bg-red-600 px-3 py-2 text-center text-white font-bold text-sm">
                      {componentData.component.name.toUpperCase()}
                    </td>
                  </tr>
                  {Array.from(componentData.standards.values())
                    .sort((a, b) => a.standard.code.localeCompare(b.standard.code, undefined, { numeric: true, sensitivity: 'base' }))
                    .map(standardData => (
                    <>
                      <tr key={`std-${standardData.standard.code}`}>
                        <td colSpan={11} className="border border-gray-300 bg-red-500 px-3 py-2 text-white font-semibold text-sm">
                          {standardData.standard.code} - {standardData.standard.name}
                        </td>
                      </tr>
                      {Array.from(standardData.conditions.values())
                        .sort((a, b) => a.condition.code.localeCompare(b.condition.code, undefined, { numeric: true, sensitivity: 'base' }))
                        .map(conditionData => {
                        const actionsCount = conditionData.actions.length;
                        return conditionData.actions.map((action, actionIndex) => (
                          <tr key={action.id} className={action.status === 'NO_ACTION' ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                            {actionIndex === 0 && (
                              <>
                                <td rowSpan={actionsCount} className="border border-gray-300 px-2 py-2 text-xs text-center align-top bg-red-100 font-medium">
                                  {conditionData.condition.code}
                                </td>
                                <td rowSpan={actionsCount} className="border border-gray-300 px-2 py-2 text-xs align-top bg-blue-50">
                                  <div className="font-semibold text-gray-900 mb-1">{conditionData.condition.code}</div>
                                  <div className="text-gray-700">{conditionData.condition.description}</div>
                                </td>
                                <td rowSpan={actionsCount} className="border border-gray-300 px-2 py-2 text-xs align-top bg-pink-50">
                                  {action.current_status_description || '-'}
                                </td>
                              </>
                            )}
                            <td className="border border-gray-300 px-2 py-2 text-xs text-center font-mono">
                              {action.status === 'NO_ACTION' ? '' : action.code}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs">
                              <div className="font-medium text-gray-900 mb-1">{action.title}</div>
                              {action.status !== 'NO_ACTION' && action.description && (
                                <div className="text-gray-600 text-xs">{action.description}</div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs">
                              {action.status === 'NO_ACTION' ? '-' : (
                                action.all_units_responsible ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Tüm Birimler
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {action.responsible_departments && action.responsible_departments.length > 0 && (
                                      action.responsible_departments.map((dept, idx) => (
                                        <div key={idx}>{dept}</div>
                                      ))
                                    )}
                                    {action.responsible_special_units && action.responsible_special_units.length > 0 && (
                                      action.responsible_special_units.map((unit, idx) => (
                                        <div key={`special-${idx}`} className="text-purple-600">{unit}</div>
                                      ))
                                    )}
                                    {(!action.responsible_departments || action.responsible_departments.length === 0) &&
                                     (!action.responsible_special_units || action.responsible_special_units.length === 0) && '-'}
                                  </div>
                                )
                              )}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs">
                              {action.status === 'NO_ACTION' ? '-' : (
                                action.all_units_collaborating ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Tüm Birimler
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {action.collaborating_departments && action.collaborating_departments.length > 0 && (
                                      action.collaborating_departments.map((dept, idx) => (
                                        <div key={idx}>{dept}</div>
                                      ))
                                    )}
                                    {action.collaborating_special_units && action.collaborating_special_units.length > 0 && (
                                      action.collaborating_special_units.map((unit, idx) => (
                                        <div key={`collab-${idx}`} className="text-purple-600">{unit}</div>
                                      ))
                                    )}
                                    {(!action.collaborating_departments || action.collaborating_departments.length === 0) &&
                                     (!action.collaborating_special_units || action.collaborating_special_units.length === 0) && '-'}
                                  </div>
                                )
                              )}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs">
                              {action.status === 'NO_ACTION' ? '-' : (action.expected_outputs || action.outputs || '-')}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs text-center whitespace-nowrap">
                              {action.status === 'NO_ACTION' ? '-' : (
                                action.is_continuous ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    Sürekli
                                  </span>
                                ) : action.completed_date ? (
                                  <span className="text-green-600 font-medium">
                                    {new Date(action.completed_date).toLocaleDateString('tr-TR')}
                                  </span>
                                ) : action.target_date ? (
                                  new Date(action.target_date).toLocaleDateString('tr-TR')
                                ) : '-'
                              )}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs">
                              {action.status === 'NO_ACTION' ? (
                                <span className="text-gray-500">-</span>
                              ) : (
                                <div className="space-y-1">
                                  <div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(action)}`}>
                                      {getStatusLabel(action.status)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                      <div
                                        className="bg-blue-600 h-1.5 rounded-full"
                                        style={{ width: `${action.progress_percent}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium">{action.progress_percent}%</span>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs text-center whitespace-nowrap">
                              {action.status !== 'NO_ACTION' && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleViewDetail(action)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Detayları Gör"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleEdit(action)}
                                    className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                    title="Düzenle"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(action)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Sil"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ));
                      })}
                    </>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Paperclip className="w-4 h-4 inline mr-1" />
                Evrak Ekle (Opsiyonel)
              </label>
              <div className="space-y-2">
                <input
                  type="file"
                  id="progress-attachment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setProgressForm({ ...progressForm, attachment: file });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                {progressForm.attachment && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    <FileText className="w-4 h-4" />
                    <span className="flex-1 truncate">{progressForm.attachment.name}</span>
                    <span className="text-xs">({(progressForm.attachment.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setProgressForm({ ...progressForm, attachment: null });
                        const input = document.getElementById('progress-attachment') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Desteklenen formatlar: PDF, Word, Excel, JPG, PNG (Maks. 10MB)
              </p>
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
            {selectedAction.status === 'NO_ACTION' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900 text-sm mb-1">Eylem Oluşturulmamış</h4>
                    <p className="text-sm text-amber-800">
                      Bu genel şart için henüz bir eylem tanımlanmamıştır. Ancak mevcut durum açıklaması girilmiştir.
                      Eylem Planları sayfasından bu genel şart için eylem ekleyebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">EYLEM BİLGİLERİ</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Genel Şart Kodu:</strong> {selectedAction.code}</div>
                {selectedAction.status !== 'NO_ACTION' && (
                  <>
                    <div><strong>Eylem Başlığı:</strong> {selectedAction.title}</div>
                    {selectedAction.description && (
                      <div><strong>Açıklama:</strong> {selectedAction.description}</div>
                    )}
                  </>
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
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Sorumlu Birimler:</strong>
                  {selectedAction.all_units_responsible ? (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Tüm Birimler
                    </span>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selectedAction.responsible_special_units && selectedAction.responsible_special_units.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Özel Birimler:</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedAction.responsible_special_units.map((unit, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                                {unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedAction.responsible_departments && selectedAction.responsible_departments.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Departmanlar:</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedAction.responsible_departments.map((dept, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                                {dept}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!selectedAction.responsible_special_units?.length && !selectedAction.responsible_departments?.length && (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <strong>İş Birliği Yapılacak Birimler:</strong>
                  {selectedAction.all_units_collaborating ? (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Tüm Birimler
                    </span>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selectedAction.collaborating_special_units && selectedAction.collaborating_special_units.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Özel Birimler:</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedAction.collaborating_special_units.map((unit, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                                {unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedAction.collaborating_departments && selectedAction.collaborating_departments.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Departmanlar:</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedAction.collaborating_departments.map((dept, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                                {dept}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!selectedAction.collaborating_special_units?.length && !selectedAction.collaborating_departments?.length && (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>
                  )}
                </div>
                {selectedAction.current_status_description && (
                  <div>
                    <strong>Mevcut Durum Açıklaması:</strong>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                      {selectedAction.current_status_description}
                    </div>
                  </div>
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
                {(selectedAction.expected_outputs || selectedAction.outputs) && (
                  <div><strong>Beklenen Çıktı:</strong> {selectedAction.expected_outputs || selectedAction.outputs}</div>
                )}
              </div>
            </div>

            {progressHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">İLERLEME GEÇMİŞİ</h3>
                <div className="space-y-3">
                  {progressHistory.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-blue-500 pl-3 text-sm flex items-start justify-between group">
                      <div className="flex-1">
                        <div className="font-medium">
                          {new Date(entry.report_date).toLocaleDateString('tr-TR')} - {entry.reporter_name}
                        </div>
                        <div className="text-gray-600">
                          %{entry.previous_progress} → %{entry.new_progress} | {entry.description}
                        </div>
                      </div>
                      {(profile?.role === 'admin' || profile?.role === 'director') && (
                        <button
                          onClick={() => handleDeleteProgressEntry(entry.id)}
                          className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="İlerleme Kaydını Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
          <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900">
                Eylem Kodu: <span className="font-bold">{selectedAction.code}</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Temel Bilgiler</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Eylem Açıklaması <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Eylem açıklaması giriniz..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Beklenen Çıktı/Sonuç
                </label>
                <textarea
                  value={editForm.expected_outputs}
                  onChange={(e) => setEditForm({ ...editForm, expected_outputs: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Beklenen çıktı veya sonuç..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Açıklama/Not
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ek açıklama veya notlar..."
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Sorumlu Birimler <span className="text-red-500">*</span></h3>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.all_units_responsible}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      all_units_responsible: e.target.checked,
                      responsible_department_ids: e.target.checked ? [] : editForm.responsible_department_ids,
                      special_responsible_types: e.target.checked ? [] : editForm.special_responsible_types
                    })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  Tüm Birimler Sorumlu
                </label>
              </div>

              {!editForm.all_units_responsible && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Özel Birimler</label>
                    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {SPECIAL_UNITS.map((unit) => (
                        <label key={unit.value} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={editForm.special_responsible_types.includes(unit.value)}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...editForm.special_responsible_types, unit.value]
                                : editForm.special_responsible_types.filter(t => t !== unit.value);
                              setEditForm({ ...editForm, special_responsible_types: newTypes });
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{unit.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Departmanlar</label>
                    <div className="bg-white rounded-lg border border-slate-200 max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {departments.map((dept) => (
                        <label key={dept.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={editForm.responsible_department_ids.includes(dept.id)}
                            onChange={(e) => {
                              const newDepts = e.target.checked
                                ? [...editForm.responsible_department_ids, dept.id]
                                : editForm.responsible_department_ids.filter(d => d !== dept.id);
                              setEditForm({ ...editForm, responsible_department_ids: newDepts });
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{dept.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">İş Birliği Yapılacak Birimler</h3>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.all_units_collaborating}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      all_units_collaborating: e.target.checked,
                      collaborating_departments_ids: e.target.checked ? [] : editForm.collaborating_departments_ids,
                      related_special_responsible_types: e.target.checked ? [] : editForm.related_special_responsible_types
                    })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  Tüm Birimler İşbirliği Yapacak
                </label>
              </div>

              {!editForm.all_units_collaborating && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Özel Birimler</label>
                    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {SPECIAL_UNITS.map((unit) => (
                        <label key={unit.value} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={editForm.related_special_responsible_types.includes(unit.value)}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...editForm.related_special_responsible_types, unit.value]
                                : editForm.related_special_responsible_types.filter(t => t !== unit.value);
                              setEditForm({ ...editForm, related_special_responsible_types: newTypes });
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{unit.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Departmanlar</label>
                    <div className="bg-white rounded-lg border border-slate-200 max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {departments.map((dept) => (
                        <label key={dept.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={editForm.collaborating_departments_ids.includes(dept.id)}
                            onChange={(e) => {
                              const newDepts = e.target.checked
                                ? [...editForm.collaborating_departments_ids, dept.id]
                                : editForm.collaborating_departments_ids.filter(d => d !== dept.id);
                              setEditForm({ ...editForm, collaborating_departments_ids: newDepts });
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{dept.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Tarih ve Süreklilik</h3>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_continuous}
                    onChange={(e) => setEditForm({ ...editForm, is_continuous: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Bu eylem sürekli olarak tekrarlanacak</span>
                </label>
              </div>

              {!editForm.is_continuous && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Hedef Tarih
                    </label>
                    <input
                      type="date"
                      value={editForm.target_date}
                      onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={submitEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Güncelle
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
