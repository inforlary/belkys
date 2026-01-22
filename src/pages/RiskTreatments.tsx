import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Trash2, Filter, TrendingUp, Calendar, ExternalLink, MoreVertical, Search, X, Link as LinkIcon, FileDown, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../utils/exportHelpers';

interface Risk {
  id: string;
  code: string;
  name: string;
  owner_department_id?: string;
}

interface Department {
  id: string;
  name: string;
}

interface ICStandard {
  id: string;
  code: string;
  name: string;
}

interface ICCondition {
  id: string;
  standard_id: string;
  code: string;
  description: string;
}

interface ICAction {
  id: string;
  code: string;
  title: string;
  condition_id: string;
}

interface Treatment {
  id: string;
  code?: string;
  title: string;
  description?: string;
  treatment_type?: string;
  responsible_department_id?: string;
  responsible_person_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  estimated_budget?: number;
  progress_percent?: number;
  status?: string;
  risk_id: string;
  risk?: Risk;
  responsible_department?: Department;
  notes?: string;
  is_ic_action?: boolean;
  ic_condition_id?: string;
  ic_action_id?: string;
  ic_condition?: ICCondition;
  ic_action?: ICAction;
}

const statusLabels: Record<string, { label: string; color: string; emoji: string }> = {
  NOT_STARTED: { label: 'Başlamadı', color: 'bg-gray-100 text-gray-800', emoji: '○' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800', emoji: '🔄' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800', emoji: '✅' },
  DELAYED: { label: 'Gecikmiş', color: 'bg-red-100 text-red-800', emoji: '⚠️' },
  CANCELLED: { label: 'İptal', color: 'bg-gray-200 text-gray-700', emoji: '✖' }
};

export default function RiskTreatments() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [icStandards, setIcStandards] = useState<ICStandard[]>([]);
  const [icConditions, setIcConditions] = useState<ICCondition[]>([]);
  const [filteredIcConditions, setFilteredIcConditions] = useState<ICCondition[]>([]);
  const [icActions, setIcActions] = useState<ICAction[]>([]);
  const [filteredIcActions, setFilteredIcActions] = useState<ICAction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    risk_id: '',
    status: '',
    department_id: '',
    date_from: '',
    date_to: '',
    search: '',
    has_ic_link: ''
  });

  const [formData, setFormData] = useState({
    risk_id: '',
    title: '',
    description: '',
    responsible_department_id: '',
    planned_end_date: '',
    notes: '',
    is_ic_action: false,
    ic_standard_id: '',
    ic_condition_id: '',
    ic_action_id: ''
  });

  const [progressData, setProgressData] = useState({
    progress_percent: 0,
    status: 'IN_PROGRESS',
    notes: '',
    completed_date: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      console.log('[RiskTreatments] Veriler yükleniyor...', {
        organization_id: profile?.organization_id,
        timestamp: new Date().toISOString()
      });

      const [treatmentsRes, risksRes, departmentsRes, icStandardsRes, icConditionsRes, icActionsRes] = await Promise.all([
        supabase
          .from('risk_treatments')
          .select(`
            *,
            risk:risks!inner(id, code, name, organization_id),
            responsible_department:departments!responsible_department_id(id, name),
            ic_condition:ic_general_conditions!ic_condition_id(id, code, description, standard_id),
            ic_action:ic_actions!ic_action_id(id, code, title)
          `)
          .eq('risk.organization_id', profile?.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('risks')
          .select('id, code, name, owner_department_id')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name'),

        supabase
          .from('ic_standards')
          .select('id, code, name')
          .order('code'),

        supabase
          .from('ic_general_conditions')
          .select('id, standard_id, code, description')
          .order('code'),

        supabase
          .from('ic_actions')
          .select('id, code, title, condition_id')
          .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`)
          .order('code')
      ]);

      if (treatmentsRes.error) {
        console.error('[RiskTreatments] Faaliyetler yüklenirken hata:', {
          error: treatmentsRes.error,
          message: treatmentsRes.error.message,
          code: treatmentsRes.error.code
        });
        throw treatmentsRes.error;
      }

      if (risksRes.error) {
        console.error('[RiskTreatments] Riskler yüklenirken hata:', {
          error: risksRes.error,
          message: risksRes.error.message,
          code: risksRes.error.code
        });
        throw risksRes.error;
      }

      if (departmentsRes.error) {
        console.error('[RiskTreatments] Birimler yüklenirken hata:', {
          error: departmentsRes.error,
          message: departmentsRes.error.message,
          code: departmentsRes.error.code
        });
        throw departmentsRes.error;
      }

      if (icStandardsRes.error) {
        console.error('[RiskTreatments] İç Kontrol Standartları yüklenirken hata:', {
          error: icStandardsRes.error,
          message: icStandardsRes.error.message,
          code: icStandardsRes.error.code
        });
        throw icStandardsRes.error;
      }

      if (icConditionsRes.error) {
        console.error('[RiskTreatments] İç Kontrol Genel Şartları yüklenirken hata:', {
          error: icConditionsRes.error,
          message: icConditionsRes.error.message,
          code: icConditionsRes.error.code
        });
        throw icConditionsRes.error;
      }

      if (icActionsRes.error) {
        console.error('[RiskTreatments] İç Kontrol Eylemleri yüklenirken hata:', {
          error: icActionsRes.error,
          message: icActionsRes.error.message,
          code: icActionsRes.error.code
        });
        throw icActionsRes.error;
      }

      const treatments = treatmentsRes.data || [];
      const risks = risksRes.data || [];
      const departments = departmentsRes.data || [];
      const icStandards = icStandardsRes.data || [];
      const icConditions = icConditionsRes.data || [];
      const icActions = icActionsRes.data || [];

      console.log('[RiskTreatments] Veriler başarıyla yüklendi:', {
        treatments: treatments.length,
        risks: risks.length,
        departments: departments.length,
        icStandards: icStandards.length,
        icConditions: icConditions.length,
        icActions: icActions.length
      });

      if (risks.length === 0) {
        console.warn('[RiskTreatments] Hiç risk bulunamadı');
      }

      if (departments.length === 0) {
        console.warn('[RiskTreatments] Hiç birim bulunamadı');
      }

      if (icStandards.length === 0) {
        console.warn('[RiskTreatments] Hiç İç Kontrol standardı bulunamadı');
      }

      if (icConditions.length === 0) {
        console.warn('[RiskTreatments] Hiç İç Kontrol genel şartı bulunamadı');
      }

      if (icActions.length === 0) {
        console.warn('[RiskTreatments] Hiç İç Kontrol eylemi bulunamadı');
      }

      setTreatments(treatments);
      setRisks(risks);
      setDepartments(departments);
      setIcStandards(icStandards);
      setIcConditions(icConditions);
      setIcActions(icActions);
    } catch (error: any) {
      console.error('[RiskTreatments] Veriler yüklenirken kritik hata:', {
        error,
        message: error?.message,
        stack: error?.stack
      });
      alert(`Veriler yüklenirken hata oluştu: ${error?.message || 'Bilinmeyen hata'}. Lütfen sayfayı yenileyin veya sistem yöneticisine başvurun.`);
    } finally {
      setLoading(false);
    }
  }

  function openModal(treatment?: Treatment) {
    console.log('[RiskTreatments] Modal açılıyor:', {
      editMode: !!treatment,
      treatmentId: treatment?.id,
      availableRisks: risks.length,
      availableDepartments: departments.length,
      availableICStandards: icStandards.length,
      availableICConditions: icConditions.length,
      availableICActions: icActions.length
    });

    if (risks.length === 0) {
      alert('Önce en az bir risk tanımlamalısınız. Risk Kaydı sayfasına yönlendiriliyorsunuz.');
      console.warn('[RiskTreatments] Hiç risk yok, modal açılamıyor');
      navigate('risk-management/risks');
      return;
    }

    if (departments.length === 0) {
      alert('Sistem ayarlarında hiç birim tanımlanmamış. Lütfen sistem yöneticisi ile iletişime geçin.');
      console.error('[RiskTreatments] Hiç birim yok, modal açılamıyor');
      return;
    }

    if (treatment) {
      console.log('[RiskTreatments] Düzenleme modu:', {
        treatmentId: treatment.id,
        treatmentTitle: treatment.title,
        riskId: treatment.risk_id,
        departmentId: treatment.responsible_department_id,
        isICAction: treatment.is_ic_action,
        icConditionId: treatment.ic_condition_id,
        icActionId: treatment.ic_action_id
      });

      const conditionStandardId = treatment.ic_condition?.standard_id || '';

      setEditingTreatment(treatment);
      setFormData({
        risk_id: treatment.risk_id,
        title: treatment.title,
        description: treatment.description || '',
        responsible_department_id: treatment.responsible_department_id || '',
        planned_end_date: treatment.planned_end_date || '',
        notes: treatment.notes || '',
        is_ic_action: treatment.is_ic_action || false,
        ic_standard_id: conditionStandardId,
        ic_condition_id: treatment.ic_condition_id || '',
        ic_action_id: treatment.ic_action_id || ''
      });

      if (conditionStandardId) {
        const filteredConditions = icConditions.filter(c => c.standard_id === conditionStandardId);
        setFilteredIcConditions(filteredConditions);
      }

      if (treatment.ic_condition_id) {
        const filteredActions = icActions.filter(a => a.condition_id === treatment.ic_condition_id);
        console.log('[RiskTreatments] IC genel şart için eylemler yüklendi:', {
          conditionId: treatment.ic_condition_id,
          actionCount: filteredActions.length
        });
        setFilteredIcActions(filteredActions);

        if (filteredActions.length === 0) {
          console.warn('[RiskTreatments] IC genel şartı için hiç eylem bulunamadı');
        }
      }
    } else {
      console.log('[RiskTreatments] Yeni kayıt modu');
      setEditingTreatment(null);
      setFormData({
        risk_id: '',
        title: '',
        description: '',
        responsible_department_id: '',
        planned_end_date: '',
        notes: '',
        is_ic_action: false,
        ic_standard_id: '',
        ic_condition_id: '',
        ic_action_id: ''
      });
      setFilteredIcConditions([]);
      setFilteredIcActions([]);
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTreatment(null);
    setFilteredIcConditions([]);
    setFilteredIcActions([]);
  }

  function handleStandardChange(standardId: string) {
    console.log('[RiskTreatments] Standart değiştirildi:', {
      standardId,
      availableConditions: icConditions.length
    });

    if (!standardId) {
      console.log('[RiskTreatments] Standart temizlendi');
      setFilteredIcConditions([]);
      setFilteredIcActions([]);
      setFormData({
        ...formData,
        ic_standard_id: '',
        ic_condition_id: '',
        ic_action_id: ''
      });
      return;
    }

    const selectedStandard = icStandards.find(s => s.id === standardId);
    console.log('[RiskTreatments] Seçilen standart:', {
      id: selectedStandard?.id,
      code: selectedStandard?.code,
      name: selectedStandard?.name
    });

    const filteredConditions = icConditions.filter(c => c.standard_id === standardId);
    console.log('[RiskTreatments] Filtrelenen genel şartlar:', {
      count: filteredConditions.length,
      conditions: filteredConditions.map(c => ({ id: c.id, code: c.code, description: c.description }))
    });

    if (filteredConditions.length === 0) {
      console.warn('[RiskTreatments] Bu standart için hiç genel şart bulunamadı');
    }

    setFilteredIcConditions(filteredConditions);
    setFilteredIcActions([]);
    setFormData({
      ...formData,
      ic_standard_id: standardId,
      ic_condition_id: '',
      ic_action_id: ''
    });
  }

  function handleConditionChange(conditionId: string) {
    console.log('[RiskTreatments] Genel şart değiştirildi:', {
      conditionId,
      availableActions: icActions.length
    });

    if (!conditionId) {
      console.log('[RiskTreatments] Genel şart temizlendi');
      setFilteredIcActions([]);
      setFormData({
        ...formData,
        ic_condition_id: '',
        ic_action_id: ''
      });
      return;
    }

    const selectedCondition = icConditions.find(c => c.id === conditionId);
    console.log('[RiskTreatments] Seçilen genel şart:', {
      id: selectedCondition?.id,
      code: selectedCondition?.code,
      description: selectedCondition?.description
    });

    const filteredActions = icActions.filter(a => a.condition_id === conditionId);
    console.log('[RiskTreatments] Filtrelenen eylemler:', {
      count: filteredActions.length,
      actions: filteredActions.map(a => ({ id: a.id, code: a.code, title: a.title }))
    });

    if (filteredActions.length === 0) {
      console.warn('[RiskTreatments] Bu genel şart için hiç eylem bulunamadı');
    }

    setFilteredIcActions(filteredActions);
    setFormData({
      ...formData,
      ic_condition_id: conditionId,
      ic_action_id: ''
    });
  }

  function handleRiskChange(riskId: string) {
    const selectedRisk = risks.find(r => r.id === riskId);
    setFormData({
      ...formData,
      risk_id: riskId,
      responsible_department_id: selectedRisk?.owner_department_id || ''
    });
  }

  function openProgressModal(treatment: Treatment) {
    setEditingTreatment(treatment);
    setProgressData({
      progress_percent: treatment.progress_percent ?? 0,
      status: treatment.status || 'IN_PROGRESS',
      notes: '',
      completed_date: treatment.actual_end_date || ''
    });
    setShowProgressModal(true);
  }

  function closeProgressModal() {
    setShowProgressModal(false);
    setEditingTreatment(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.risk_id || !formData.title || !formData.planned_end_date) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      let code = '';
      if (!editingTreatment) {
        const { data: existingTreatments } = await supabase
          .from('risk_treatments')
          .select('code')
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (existingTreatments && existingTreatments.length > 0) {
          const lastCode = existingTreatments[0].code;
          const match = lastCode?.match(/F-(\d+)$/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        code = `F-${nextNumber.toString().padStart(3, '0')}`;
      }

      const treatmentData = {
        risk_id: formData.risk_id,
        code: editingTreatment ? editingTreatment.code : code,
        title: formData.title,
        description: formData.description,
        responsible_department_id: formData.responsible_department_id || null,
        planned_end_date: formData.planned_end_date,
        notes: formData.notes,
        status: editingTreatment ? (editingTreatment.status || 'NOT_STARTED') : 'NOT_STARTED',
        progress_percent: editingTreatment ? (editingTreatment.progress_percent ?? 0) : 0,
        is_ic_action: formData.is_ic_action,
        ic_condition_id: formData.is_ic_action && formData.ic_condition_id ? formData.ic_condition_id : null,
        ic_action_id: formData.is_ic_action && formData.ic_action_id ? formData.ic_action_id : null
      };

      if (editingTreatment) {
        const { error } = await supabase
          .from('risk_treatments')
          .update(treatmentData)
          .eq('id', editingTreatment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_treatments')
          .insert(treatmentData);

        if (error) throw error;
      }

      closeModal();
      loadData();
    } catch (error) {
      console.error('Faaliyet kaydedilirken hata:', error);
      alert('Faaliyet kaydedilemedi');
    }
  }

  async function handleProgressUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!editingTreatment || !progressData.notes) {
      alert('Lütfen güncelleme notu girin');
      return;
    }

    if (progressData.progress_percent === 100 && progressData.status !== 'COMPLETED') {
      if (!confirm('İlerleme %100 ancak durum Tamamlandı değil. Durumu Tamamlandı olarak işaretlemek ister misiniz?')) {
        return;
      }
      progressData.status = 'COMPLETED';
    }

    try {
      const updateData: any = {
        progress_percent: progressData.progress_percent,
        status: progressData.status
      };

      if (progressData.status === 'COMPLETED' && progressData.completed_date) {
        updateData.actual_end_date = progressData.completed_date;
      }

      const { error: updateError } = await supabase
        .from('risk_treatments')
        .update(updateData)
        .eq('id', editingTreatment.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('risk_treatment_updates')
        .insert({
          treatment_id: editingTreatment.id,
          updated_by_id: profile?.id,
          previous_progress: editingTreatment.progress_percent ?? 0,
          new_progress: progressData.progress_percent,
          previous_status: editingTreatment.status || 'NOT_STARTED',
          new_status: progressData.status,
          notes: progressData.notes
        });

      if (historyError) throw historyError;

      closeProgressModal();
      loadData();
    } catch (error) {
      console.error('İlerleme güncellenirken hata:', error);
      alert('İlerleme güncellenemedi');
    }
  }

  async function handleDelete(treatment: Treatment) {
    if (!confirm(`${treatment.code} - ${treatment.title} faaliyetini silmek istediğinize emin misiniz?\n\nİlerleme geçmişi de silinecektir.`)) return;

    try {
      const { error } = await supabase
        .from('risk_treatments')
        .delete()
        .eq('id', treatment.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Faaliyet silinirken hata:', error);
      alert('Faaliyet silinemedi');
    }
  }

  function getDelayDays(treatment: Treatment | null): number {
    if (!treatment || !treatment.planned_end_date) return 0;
    if (treatment.status === 'COMPLETED' || treatment.status === 'CANCELLED') return 0;
    const endDate = new Date(treatment.planned_end_date);
    const today = new Date();
    if (endDate < today) {
      return Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 0;
  }

  function isDueSoon(treatment: Treatment | null): boolean {
    if (!treatment || !treatment.planned_end_date) return false;
    if (treatment.status === 'COMPLETED' || treatment.status === 'CANCELLED') return false;
    const endDate = new Date(treatment.planned_end_date);
    const today = new Date();
    const diffDays = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }

  const filteredTreatments = treatments.filter(t => {
    if (!t) return false;
    if (filters.risk_id && t.risk_id !== filters.risk_id) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.department_id && t.responsible_department_id !== filters.department_id) return false;
    if (filters.date_from && t.planned_end_date && t.planned_end_date < filters.date_from) return false;
    if (filters.date_to && t.planned_end_date && t.planned_end_date > filters.date_to) return false;
    if (filters.has_ic_link) {
      if (filters.has_ic_link === 'yes' && !t.is_ic_action) return false;
      if (filters.has_ic_link === 'no' && t.is_ic_action) return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return t.code?.toLowerCase().includes(search) || t.title?.toLowerCase().includes(search);
    }
    return true;
  });

  const sortedTreatments = [...filteredTreatments].sort((a, b) => {
    if (!a || !b) return 0;

    const aDelayed = getDelayDays(a) > 0;
    const bDelayed = getDelayDays(b) > 0;

    if (aDelayed && !bDelayed) return -1;
    if (!aDelayed && bDelayed) return 1;

    const statusOrder: Record<string, number> = {
      'DELAYED': 1,
      'IN_PROGRESS': 2,
      'NOT_STARTED': 3,
      'COMPLETED': 4,
      'CANCELLED': 5
    };

    const aOrder = statusOrder[a.status || ''] || 999;
    const bOrder = statusOrder[b.status || ''] || 999;

    if (aOrder !== bOrder) return aOrder - bOrder;

    const aDate = a.planned_end_date ? new Date(a.planned_end_date).getTime() : 0;
    const bDate = b.planned_end_date ? new Date(b.planned_end_date).getTime() : 0;

    return aDate - bDate;
  });

  const stats = {
    total: filteredTreatments.length,
    inProgress: filteredTreatments.filter(t => t && t.status === 'IN_PROGRESS').length,
    completed: filteredTreatments.filter(t => t && t.status === 'COMPLETED').length,
    delayed: filteredTreatments.filter(t => t && getDelayDays(t) > 0).length
  };

  function clearFilters() {
    setFilters({
      risk_id: '',
      status: '',
      department_id: '',
      date_from: '',
      date_to: '',
      search: '',
      has_ic_link: ''
    });
  }

  const exportToExcelHandler = () => {
    const exportData = sortedTreatments.map(treatment => ({
      'Faaliyet Kodu': treatment.code || '-',
      'Risk Kodu': treatment.risk?.code || '-',
      'Risk Adı': treatment.risk?.name || '-',
      'Faaliyet Başlığı': treatment.title,
      'Açıklama': treatment.description || '-',
      'Sorumlu Birim': treatment.responsible_department?.name || '-',
      'Planlanan Bitiş': treatment.planned_end_date || '-',
      'Gerçekleşen Bitiş': treatment.actual_end_date || '-',
      'İlerleme (%)': treatment.progress_percent || 0,
      'Durum': statusLabels[treatment.status || 'NOT_STARTED']?.label || '-',
      'İÇ Kontrol Bağlantısı': treatment.is_ic_action ? 'Evet' : 'Hayır',
      'İÇ Genel Şart': treatment.ic_condition?.description || '-',
      'İÇ Faaliyet': treatment.ic_action?.title || '-',
      'Notlar': treatment.notes || '-'
    }));
    exportToExcel(exportData, `risk_faaliyetleri_${new Date().toISOString().split('T')[0]}`);
  };

  const exportToPDFHandler = () => {
    const headers = ['Kod', 'Risk', 'Faaliyet', 'Sorumlu', 'Planlanan Bitiş', 'İlerleme', 'Durum'];
    const rows = sortedTreatments.map(treatment => [
      treatment.code || '-',
      treatment.risk?.code || '-',
      treatment.title,
      treatment.responsible_department?.name || '-',
      treatment.planned_end_date || '-',
      `${treatment.progress_percent || 0}%`,
      statusLabels[treatment.status || 'NOT_STARTED']?.label || '-'
    ]);

    const content = `
      <h2>Faaliyet İstatistikleri</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Toplam Faaliyet</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #2563eb;">
          <div class="stat-value" style="color: #2563eb;">${stats.inProgress}</div>
          <div class="stat-label">Devam Eden</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #16a34a;">
          <div class="stat-value" style="color: #16a34a;">${stats.completed}</div>
          <div class="stat-label">Tamamlanan</div>
        </div>
        <div class="stat-box" style="border-left: 4px solid #dc2626;">
          <div class="stat-value" style="color: #dc2626;">${stats.delayed}</div>
          <div class="stat-label">Gecikmiş</div>
        </div>
      </div>
      <h2>Risk Faaliyetleri Listesi</h2>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF('Risk Faaliyetleri Raporu', content, `risk_faaliyetleri_${new Date().toISOString().split('T')[0]}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  const getStandardName = (conditionId?: string) => {
    if (!conditionId) return '';
    const condition = icConditions.find(c => c.id === conditionId);
    if (!condition) return '';
    const standard = icStandards.find(s => s.id === condition.standard_id);
    return standard ? `${standard.code} - ${standard.name}` : '';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7" />
            Risk Faaliyetleri
          </h1>
          <p className="text-gray-600 mt-1">Risk azaltma faaliyetleri takibi</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcelHandler}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={exportToPDFHandler}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Faaliyet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition"
          onClick={() => setFilters({ ...filters, status: '' })}
        >
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Toplam</div>
            <div className="text-xs text-gray-500 mt-1">Faaliyet</div>
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition"
          onClick={() => setFilters({ ...filters, status: 'IN_PROGRESS' })}
        >
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600 mt-1">Devam Eden</div>
            <div className="text-xs text-gray-500 mt-1">🔄 Aktif</div>
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition"
          onClick={() => setFilters({ ...filters, status: 'COMPLETED' })}
        >
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600 mt-1">Tamamlanan</div>
            <div className="text-xs text-gray-500 mt-1">✅ Biten</div>
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition"
          onClick={() => setFilters({ ...filters, status: 'DELAYED' })}
        >
          <div className="p-6 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.delayed}</div>
            <div className="text-sm text-gray-600 mt-1">Geciken</div>
            <div className="text-xs text-gray-500 mt-1">⚠️ Gecikmiş</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Filtreler</h3>
            </div>
            {(filters.risk_id || filters.status || filters.department_id || filters.date_from || filters.date_to || filters.search) && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Temizle
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div>
              <select
                value={filters.risk_id}
                onChange={(e) => setFilters({ ...filters, risk_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Risk ▼</option>
                {risks.map((risk) => (
                  <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.department_id}
                onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Birim ▼</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Durum ▼</option>
                {Object.entries(statusLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filters.has_ic_link}
                onChange={(e) => setFilters({ ...filters, has_ic_link: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">İK Bağlantısı ▼</option>
                <option value="yes">Bağlantılı</option>
                <option value="no">Bağlantısız</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Başlangıç"
              />
            </div>

            <div>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Bitiş"
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Ara..."
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faaliyet Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlişkili Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Birim</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İK</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hedef Tarih</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlerleme</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedTreatments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Faaliyet bulunamadı
                  </td>
                </tr>
              ) : (
                sortedTreatments.map((treatment) => {
                  const delayDays = getDelayDays(treatment);
                  const isDelayed = delayDays > 0;
                  const dueSoon = isDueSoon(treatment);
                  const statusInfo = statusLabels[treatment.status] || statusLabels['NOT_STARTED'];

                  return (
                    <tr
                      key={treatment.id}
                      className="hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => openProgressModal(treatment)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{treatment.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{treatment.title}</td>
                      <td className="px-4 py-3">
                        {treatment.risk ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{treatment.risk.code}</div>
                            <div className="text-xs text-gray-500">{treatment.risk.name}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-red-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {treatment.responsible_department?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {treatment.is_ic_action ? (
                          <span className="text-green-600" title="İç Kontrol Bağlantılı">✅</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className={isDelayed ? 'text-red-600 font-medium' : dueSoon ? 'text-yellow-600 font-medium' : 'text-gray-700'}>
                            {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
                          </div>
                          {isDelayed && (
                            <div className="text-xs text-red-600 font-medium">
                              🔴 {delayDays} gün
                            </div>
                          )}
                          {dueSoon && !isDelayed && (
                            <div className="text-xs text-yellow-600">
                              🟡 Yaklaşıyor
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <span>{statusInfo.emoji}</span>
                              <span>{treatment.progress_percent ?? 0}%</span>
                              {isDelayed && treatment.status !== 'COMPLETED' && (
                                <span className="ml-1">Gecikmiş</span>
                              )}
                              {treatment.status === 'NOT_STARTED' && (
                                <span className="ml-1">Başlamadı</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === treatment.id ? null : treatment.id);
                            }}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenu === treatment.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(null);
                                }}
                              />
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    openProgressModal(treatment);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                  İlerleme Güncelle
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    openModal(treatment);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit className="w-4 h-4" />
                                  Düzenle
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    navigate(`risk-management/risks/${treatment.risk_id}`);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Riske Git
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                    handleDelete(treatment);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Sil
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingTreatment ? 'Faaliyet Düzenle' : 'Yeni Faaliyet Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlişkili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.risk_id}
              onChange={(e) => handleRiskChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!editingTreatment}
            >
              <option value="">Seçiniz...</option>
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
              ))}
            </select>
            {risks.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠ Henüz risk tanımlanmamış. Lütfen önce Risk Kaydı sayfasından risk ekleyin.
              </p>
            )}
            {formData.risk_id && formData.responsible_department_id && !editingTreatment && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Sorumlu birim otomatik olarak yüklendi
              </p>
            )}
          </div>

          {!editingTreatment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Faaliyet Kodu</label>
              <input
                type="text"
                value="Otomatik oluşturulacak"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                disabled
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Faaliyet Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.responsible_department_id}
              onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seçiniz...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            {departments.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠ Birim bulunamadı. Lütfen sistem yöneticisi ile iletişime geçin.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hedef Tarih <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.planned_end_date}
              onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium text-gray-900">İç Kontrol Bağlantısı</h3>
            </div>

            <div className="space-y-4 bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_ic_action"
                  checked={formData.is_ic_action}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      is_ic_action: e.target.checked,
                      ic_standard_id: e.target.checked ? formData.ic_standard_id : '',
                      ic_condition_id: e.target.checked ? formData.ic_condition_id : '',
                      ic_action_id: e.target.checked ? formData.ic_action_id : ''
                    });
                    if (!e.target.checked) {
                      setFilteredIcConditions([]);
                      setFilteredIcActions([]);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_ic_action" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Bu faaliyet bir İç Kontrol eylemi mi?
                </label>
              </div>

              {formData.is_ic_action && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Standart <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.ic_standard_id}
                      onChange={(e) => handleStandardChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required={formData.is_ic_action}
                    >
                      <option value="">Seçiniz...</option>
                      {icStandards.map((standard) => (
                        <option key={standard.id} value={standard.id}>
                          {standard.code} - {standard.name}
                        </option>
                      ))}
                    </select>
                    {icStandards.length === 0 && (
                      <p className="text-xs text-yellow-600 mt-1">
                        ⚠ İç kontrol standartları yüklenemedi. Lütfen sayfayı yenileyin.
                      </p>
                    )}
                  </div>

                  {formData.ic_standard_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Genel Şart <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.ic_condition_id}
                        onChange={(e) => handleConditionChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required={formData.is_ic_action}
                      >
                        <option value="">Seçiniz...</option>
                        {filteredIcConditions.map((condition) => (
                          <option key={condition.id} value={condition.id}>
                            {condition.code} - {condition.description}
                          </option>
                        ))}
                      </select>
                      {filteredIcConditions.length === 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠ Bu standart için henüz genel şart tanımlanmamış
                        </p>
                      )}
                    </div>
                  )}

                  {formData.ic_condition_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        İç Kontrol Eylemi <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.ic_action_id}
                        onChange={(e) => setFormData({ ...formData, ic_action_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required={formData.is_ic_action}
                      >
                        <option value="">Seçiniz...</option>
                        {filteredIcActions.map((action) => (
                          <option key={action.id} value={action.id}>
                            {action.code} - {action.title}
                          </option>
                        ))}
                      </select>
                      {filteredIcActions.length === 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠ Bu genel şart için henüz eylem tanımlanmamış
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Kaydet
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showProgressModal} onClose={closeProgressModal} title="İlerleme Güncelle">
        <form onSubmit={handleProgressUpdate} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="text-sm font-medium text-gray-900">
              {editingTreatment?.code} - {editingTreatment?.title}
            </div>
            <div className="text-sm text-gray-600">
              Risk: {editingTreatment?.risk?.code} - {editingTreatment?.risk?.name}
            </div>
            <div className="text-sm text-gray-600">
              Sorumlu: {editingTreatment?.responsible_department?.name || '-'}
            </div>
            <div className="text-sm">
              Hedef Tarih: <span className={getDelayDays(editingTreatment) > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                {editingTreatment?.planned_end_date && new Date(editingTreatment.planned_end_date).toLocaleDateString('tr-TR')}
                {getDelayDays(editingTreatment) > 0 && (
                  <span className="ml-2">🔴 {getDelayDays(editingTreatment)} gün gecikmiş</span>
                )}
              </span>
            </div>

            {editingTreatment?.is_ic_action && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">İç Kontrol Bağlantısı</span>
                </div>
                <div className="text-sm text-gray-700 space-y-1 ml-6">
                  <div>
                    <span className="font-medium">Standart:</span> {getStandardName(editingTreatment.ic_condition_id)}
                  </div>
                  <div>
                    <span className="font-medium">Genel Şart:</span> {editingTreatment.ic_condition?.code} - {editingTreatment.ic_condition?.description}
                  </div>
                  <div>
                    <span className="font-medium">Eylem:</span> {editingTreatment.ic_action?.code} - {editingTreatment.ic_action?.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/ic-actions/${editingTreatment.ic_action_id}`)}
                  className="mt-2 ml-6 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  İç Kontrol Eylemine Git
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Mevcut İlerleme: %{editingTreatment?.progress_percent ?? 0}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Yeni İlerleme <span className="text-red-500">*</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressData.progress_percent}
              onChange={(e) => setProgressData({ ...progressData, progress_percent: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">0%</span>
              <span className="text-lg font-semibold text-blue-600">%{progressData.progress_percent}</span>
              <span className="text-gray-600">100%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durum <span className="text-red-500">*</span>
            </label>
            <select
              value={progressData.status}
              onChange={(e) => setProgressData({ ...progressData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="NOT_STARTED">Başlamadı</option>
              <option value="IN_PROGRESS">Devam Ediyor</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>
          </div>

          {progressData.status === 'COMPLETED' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tamamlanma Tarihi
              </label>
              <input
                type="date"
                value={progressData.completed_date}
                onChange={(e) => setProgressData({ ...progressData, completed_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Güncelleme Notu <span className="text-red-500">*</span>
            </label>
            <textarea
              value={progressData.notes}
              onChange={(e) => setProgressData({ ...progressData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Yapılan çalışmayı açıklayın..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={closeProgressModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Güncelle
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
