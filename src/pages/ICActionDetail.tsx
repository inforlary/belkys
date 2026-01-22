import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Plus, Download, Trash2, FileText, Upload, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import Modal from '../components/ui/Modal';

interface Action {
  id: string;
  code: string;
  title: string;
  description: string;
  standard_id: string;
  responsible_department_id: string;
  special_responsible_type?: string;
  special_responsible?: string;
  start_date: string;
  target_date: string;
  priority: string;
  status: string;
  progress_percent: number;
  expected_output: string;
  required_resources: string;
  metadata: any;
  ic_standards?: {
    code: string;
    name: string;
    ic_component_id: string;
    ic_components?: {
      name: string;
    };
  };
  departments?: {
    name: string;
  };
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
  challenges: string;
  next_steps: string;
  profiles?: {
    full_name: string;
  };
}

interface Document {
  id: string;
  name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  uploaded_by_id: string;
  uploaded_at: string;
  profiles?: {
    full_name: string;
  };
}

export default function ICActionDetail() {
  const { profile } = useAuth();
  const { navigate: navigateTo, currentPath, getPathParam } = useLocation();
  const pathParts = currentPath.split('/');
  const planId = pathParts[pathParts.indexOf('action-plans') + 1];
  const actionId = getPathParam();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [action, setAction] = useState<Action | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressEntry[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [relatedDepartments, setRelatedDepartments] = useState<any[]>([]);
  const [linkedRisk, setLinkedRisk] = useState<any>(null);
  const [linkedGoal, setLinkedGoal] = useState<any>(null);
  const [linkedControl, setLinkedControl] = useState<any>(null);
  const [linkedActivity, setLinkedActivity] = useState<any>(null);

  const [riskModuleData, setRiskModuleData] = useState<{
    standard6?: {
      totalRisks: number;
      strategic: number;
      operational: number;
      project: number;
      corporate: number;
      assessed: number;
      lastUpdate: string | null;
    };
    standard7?: {
      totalControls: number;
      effective: number;
      partiallyEffective: number;
      ineffective: number;
      totalActivities: number;
      completed: number;
      inProgress: number;
      pending: number;
    };
  }>({});

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'progress' | 'documents' | 'relations' | 'risk_treatments'>('details');
  const [linkedRiskTreatments, setLinkedRiskTreatments] = useState<any[]>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [progressForm, setProgressForm] = useState({
    new_progress: 0,
    new_status: '',
    description: '',
    challenges: '',
    next_steps: '',
    attachment: null as File | null
  });

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    file_type: 'document'
  });

  useEffect(() => {
    if (profile?.organization_id && actionId) {
      loadData();
    }
  }, [profile?.organization_id, actionId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadRiskModuleData = async (standardCode: string) => {
    try {
      if (standardCode === 'KIKS.6') {
        const { data: risks } = await supabase
          .from('risks')
          .select('id, risk_relation, created_at, updated_at')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true);

        const totalRisks = risks?.length || 0;
        const strategic = risks?.filter(r => r.risk_relation === 'STRATEGIC').length || 0;
        const operational = risks?.filter(r => r.risk_relation === 'OPERATIONAL').length || 0;
        const project = risks?.filter(r => r.risk_relation === 'PROJECT').length || 0;
        const corporate = risks?.filter(r => r.risk_relation === 'CORPORATE').length || 0;

        const { data: assessments } = await supabase
          .from('rm_risk_assessments')
          .select('risk_id')
          .eq('organization_id', profile?.organization_id);

        const assessed = new Set(assessments?.map(a => a.risk_id) || []).size;

        const lastUpdate = risks && risks.length > 0
          ? new Date(Math.max(...risks.map(r => new Date(r.updated_at || r.created_at).getTime()))).toLocaleDateString('tr-TR')
          : null;

        setRiskModuleData(prev => ({
          ...prev,
          standard6: {
            totalRisks,
            strategic,
            operational,
            project,
            corporate,
            assessed,
            lastUpdate
          }
        }));
      }

      if (standardCode === 'KIKS.7') {
        const [controlsRes, activitiesRes] = await Promise.all([
          supabase
            .from('risk_controls')
            .select('id, design_effectiveness, operating_effectiveness')
            .eq('organization_id', profile?.organization_id),
          supabase
            .from('risk_treatments')
            .select('id, status')
            .eq('organization_id', profile?.organization_id)
        ]);

        const totalControls = controlsRes.data?.length || 0;
        const effective = controlsRes.data?.filter(c =>
          c.design_effectiveness >= 80 && c.operating_effectiveness >= 80
        ).length || 0;
        const partiallyEffective = controlsRes.data?.filter(c =>
          (c.design_effectiveness >= 50 && c.design_effectiveness < 80) ||
          (c.operating_effectiveness >= 50 && c.operating_effectiveness < 80)
        ).length || 0;
        const ineffective = controlsRes.data?.filter(c =>
          c.design_effectiveness < 50 || c.operating_effectiveness < 50
        ).length || 0;

        const totalActivities = activitiesRes.data?.length || 0;
        const completed = activitiesRes.data?.filter(a => a.status === 'COMPLETED').length || 0;
        const inProgress = activitiesRes.data?.filter(a => a.status === 'IN_PROGRESS').length || 0;
        const pending = activitiesRes.data?.filter(a => a.status === 'PENDING').length || 0;

        setRiskModuleData(prev => ({
          ...prev,
          standard7: {
            totalControls,
            effective,
            partiallyEffective,
            ineffective,
            totalActivities,
            completed,
            inProgress,
            pending
          }
        }));
      }
    } catch (error) {
      console.error('Risk modülü verileri yüklenirken hata:', error);
    }
  };

  const loadData = async () => {
    try {
      const [actionRes, progressRes, docsRes] = await Promise.all([
        supabase
          .from('ic_actions')
          .select(`
            *,
            ic_standards(code, name, ic_component_id, ic_components(name)),
            departments(name)
          `)
          .eq('id', actionId)
          .single(),
        supabase
          .from('ic_action_progress')
          .select('*, profiles(full_name)')
          .eq('action_id', actionId)
          .order('report_date', { ascending: false }),
        supabase
          .from('ic_action_documents')
          .select('*, profiles(full_name)')
          .eq('action_id', actionId)
          .order('uploaded_at', { ascending: false })
      ]);

      if (actionRes.error) throw actionRes.error;

      setAction(actionRes.data);
      setProgressHistory(progressRes.data || []);
      setDocuments(docsRes.data || []);

      const { data: riskTreatments } = await supabase
        .from('risk_treatments')
        .select(`
          *,
          risk:risks(id, code, name),
          responsible_department:departments!responsible_department_id(id, name)
        `)
        .eq('ic_action_id', actionId)
        .order('created_at', { ascending: false });

      setLinkedRiskTreatments(riskTreatments || []);

      if (actionRes.data.metadata) {
        const metadata = actionRes.data.metadata;

        if (metadata.related_departments?.length > 0) {
          const { data: depts } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', metadata.related_departments);
          setRelatedDepartments(depts || []);
        }

        if (metadata.linked_risk_id) {
          const { data: risk } = await supabase
            .from('risks')
            .select('id, code, name')
            .eq('id', metadata.linked_risk_id)
            .single();
          setLinkedRisk(risk);
        }

        if (metadata.linked_goal_id) {
          const { data: goal } = await supabase
            .from('goals')
            .select('id, code, title')
            .eq('id', metadata.linked_goal_id)
            .single();
          setLinkedGoal(goal);
        }

        if (metadata.linked_control_id) {
          const { data: control } = await supabase
            .from('risk_controls')
            .select('id, name')
            .eq('id', metadata.linked_control_id)
            .single();
          setLinkedControl(control);
        }

        if (metadata.linked_activity_id) {
          const { data: activity } = await supabase
            .from('risk_treatments')
            .select('id, code, title')
            .eq('id', metadata.linked_activity_id)
            .single();
          setLinkedActivity(activity);
        }
      }

      setProgressForm({
        ...progressForm,
        new_progress: actionRes.data.progress_percent || 0,
        new_status: actionRes.data.status
      });

      if (actionRes.data.ic_standards?.code) {
        await loadRiskModuleData(actionRes.data.ic_standards.code);
      }
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let attachmentUrl = null;

      if (progressForm.attachment) {
        const fileExt = progressForm.attachment.name.split('.').pop();
        const fileName = `${actionId}/progress/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ic-action-documents')
          .upload(fileName, progressForm.attachment);

        if (uploadError) throw uploadError;
        attachmentUrl = fileName;
      }

      const { error: progressError } = await supabase
        .from('ic_action_progress')
        .insert({
          action_id: actionId,
          report_date: new Date().toISOString().split('T')[0],
          reported_by_id: profile?.id,
          previous_progress: action?.progress_percent || 0,
          new_progress: progressForm.new_progress,
          previous_status: action?.status,
          new_status: progressForm.new_status,
          description: progressForm.description,
          challenges: progressForm.challenges,
          next_steps: progressForm.next_steps
        });

      if (progressError) throw progressError;

      if (attachmentUrl) {
        await supabase
          .from('ic_action_documents')
          .insert({
            action_id: actionId,
            name: progressForm.attachment!.name,
            file_url: attachmentUrl,
            file_size: progressForm.attachment!.size,
            file_type: 'progress_attachment',
            uploaded_by_id: profile?.id
          });
      }

      const updateData: any = {
        progress_percent: progressForm.new_progress,
        status: progressForm.new_status
      };

      if (progressForm.new_status === 'COMPLETED' && !action?.metadata?.completed_date) {
        updateData.metadata = {
          ...action?.metadata,
          completed_date: new Date().toISOString()
        };
      }

      if (action?.target_date) {
        const targetDate = new Date(action.target_date);
        const today = new Date();
        if (targetDate < today && progressForm.new_status !== 'COMPLETED') {
          updateData.status = 'DELAYED';
        }
      }

      const { error: updateError } = await supabase
        .from('ic_actions')
        .update(updateData)
        .eq('id', actionId);

      if (updateError) throw updateError;

      setShowProgressModal(false);
      setProgressForm({
        new_progress: 0,
        new_status: '',
        description: '',
        challenges: '',
        next_steps: '',
        attachment: null
      });
      setToast({ message: 'İlerleme başarıyla kaydedildi', type: 'success' });
      loadData();
    } catch (error) {
      console.error('İlerleme kaydedilirken hata:', error);
      setToast({ message: 'İlerleme kaydedilirken bir hata oluştu', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) return;

    setSaving(true);
    setUploadProgress(0);

    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${actionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('ic-action-documents')
        .upload(fileName, uploadForm.file, {
          onUploadProgress: (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            setUploadProgress(percent);
          }
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('ic_action_documents')
        .insert({
          action_id: actionId,
          name: uploadForm.file.name,
          file_url: fileName,
          file_size: uploadForm.file.size,
          file_type: uploadForm.file_type,
          uploaded_by_id: profile?.id
        });

      if (dbError) throw dbError;

      setShowUploadModal(false);
      setUploadForm({ file: null, file_type: 'document' });
      setUploadProgress(0);
      loadData();
    } catch (error) {
      console.error('Dosya yüklenirken hata:', error);
      alert('Dosya yüklenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ic-action-documents')
        .download(doc.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Dosya indirilirken hata:', error);
      alert('Dosya indirilirken bir hata oluştu');
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!confirm('Bu belgeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('ic-action-documents')
        .remove([doc.file_url]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('ic_action_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      loadData();
    } catch (error) {
      console.error('Belge silinirken hata:', error);
      alert('Belge silinirken bir hata oluştu');
    }
  };

  const handleDeleteProgress = async (progressId: string) => {
    if (!confirm('Bu ilerleme kaydını silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_action_progress')
        .delete()
        .eq('id', progressId);

      if (error) {
        console.error('DELETE error details:', error);
        throw error;
      }

      setToast({ message: 'İlerleme kaydı başarıyla silindi', type: 'success' });
      loadData();
    } catch (error: any) {
      console.error('İlerleme kaydı silinirken hata:', error);
      const errorMessage = error?.message || 'İlerleme kaydı silinirken hata oluştu';
      setToast({ message: errorMessage, type: 'error' });
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      NOT_STARTED: 'bg-slate-100 text-slate-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DELAYED: 'bg-red-100 text-red-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-slate-200 text-slate-700'
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOT_STARTED: 'Başlamadı',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      DELAYED: 'Gecikmiş',
      ON_HOLD: 'Beklemede',
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

  const getRemainingDays = () => {
    if (!action?.target_date) return 0;
    const today = new Date();
    const target = new Date(action.target_date);
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      document: 'Doküman',
      report: 'Rapor',
      procedure: 'Prosedür',
      other: 'Diğer'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Eylem bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <button
          onClick={() => navigateTo(`internal-control/action-plans/${planId}`)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Eylem Planına Dön
        </button>

        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {action.code} - {action.title}
            </h1>
            <div className="text-sm text-slate-600 mb-2">
              <div className="font-medium">Standart: {action.ic_standards?.code} - {action.ic_standards?.name}</div>
              <div>Bileşen: {action.ic_standards?.ic_components?.name}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigateTo(`internal-control/action-plans/${planId}/actions/${actionId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              <Edit className="w-4 h-4" />
              Düzenle
            </button>
            <button
              onClick={() => setShowProgressModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              İlerleme Ekle
            </button>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-slate-700">İlerleme: {action.progress_percent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-green-600 h-full rounded-full transition-all"
                style={{ width: `${action.progress_percent}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Durum:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(action.status)}`}>
                {getStatusLabel(action.status)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Öncelik:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(action.priority)}`}>
                {getPriorityLabel(action.priority)}
              </span>
            </div>
            <div className="border-l border-slate-300 pl-4">
              <span className="text-slate-600">Başlangıç: </span>
              <span className="font-medium">{action.start_date ? new Date(action.start_date).toLocaleDateString('tr-TR') : '-'}</span>
            </div>
            <div>
              <span className="text-slate-600">Hedef: </span>
              <span className="font-medium">{new Date(action.target_date).toLocaleDateString('tr-TR')}</span>
            </div>
            <div>
              <span className="text-slate-600">Kalan: </span>
              <span className={`font-medium ${getRemainingDays() < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {getRemainingDays()} gün
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            {[
              { id: 'details', label: 'Detaylar' },
              { id: 'progress', label: 'İlerleme Geçmişi' },
              { id: 'documents', label: 'Belgeler' },
              { id: 'relations', label: 'İlişkiler' },
              { id: 'risk_treatments', label: `Risk Faaliyetleri${linkedRiskTreatments.length > 0 ? ` (${linkedRiskTreatments.length})` : ''}` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {action.ic_standards?.code === 'KIKS.6' && riskModuleData.standard6 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      📊 Risk Modülü Verileri (Otomatik)
                    </h3>
                    <button
                      onClick={() => navigateTo('risk-management/risks')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Risk Modülüne Git
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Toplam Tanımlı Risk: <span className="text-2xl font-bold text-blue-600">{riskModuleData.standard6.totalRisks}</span>
                      </div>
                      <div className="pl-4 space-y-1 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>├── Stratejik:</span>
                          <span className="font-semibold">{riskModuleData.standard6.strategic}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>├── Operasyonel:</span>
                          <span className="font-semibold">{riskModuleData.standard6.operational}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>├── Proje:</span>
                          <span className="font-semibold">{riskModuleData.standard6.project}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>└── Kurumsal:</span>
                          <span className="font-semibold">{riskModuleData.standard6.corporate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-medium">Değerlendirilen Risk:</span>
                        <span className="text-lg font-bold text-green-600">{riskModuleData.standard6.assessed}</span>
                      </div>
                    </div>

                    {riskModuleData.standard6.lastUpdate && (
                      <div className="pt-2 text-xs text-slate-500">
                        Son Güncelleme: {riskModuleData.standard6.lastUpdate}
                      </div>
                    )}

                    {riskModuleData.standard6.totalRisks === 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        ⚠️ Henüz risk tanımlanmamış. Lütfen Risk Modülünde risk tanımlamaya başlayın.
                      </div>
                    )}

                    {riskModuleData.standard6.totalRisks > 0 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                        ✅ Bu standart için Risk Modülü verileri mevcut. Tamamlanma: %100
                      </div>
                    )}
                  </div>
                </div>
              )}

              {action.ic_standards?.code === 'KIKS.7' && riskModuleData.standard7 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      📊 Risk Modülü Verileri (Otomatik)
                    </h3>
                    <button
                      onClick={() => navigateTo('risk-management/treatments')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Risk Faaliyetlerine Git
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Toplam Kontrol: <span className="text-2xl font-bold text-green-600">{riskModuleData.standard7.totalControls}</span>
                      </div>
                      <div className="pl-4 space-y-1 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>├── Etkin:</span>
                          <span className="font-semibold text-green-600">{riskModuleData.standard7.effective}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>├── Kısmen Etkin:</span>
                          <span className="font-semibold text-yellow-600">{riskModuleData.standard7.partiallyEffective}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>└── Etkin Değil:</span>
                          <span className="font-semibold text-red-600">{riskModuleData.standard7.ineffective}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-green-200">
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Toplam Faaliyet: <span className="text-2xl font-bold text-green-600">{riskModuleData.standard7.totalActivities}</span>
                      </div>
                      <div className="pl-4 space-y-1 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>├── Tamamlanan:</span>
                          <span className="font-semibold text-green-600">{riskModuleData.standard7.completed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>├── Devam Eden:</span>
                          <span className="font-semibold text-blue-600">{riskModuleData.standard7.inProgress}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>└── Bekleyen:</span>
                          <span className="font-semibold text-gray-600">{riskModuleData.standard7.pending}</span>
                        </div>
                      </div>
                    </div>

                    {riskModuleData.standard7.totalActivities > 0 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                        ✅ Tamamlanma Oranı: {Math.round((riskModuleData.standard7.completed / riskModuleData.standard7.totalActivities) * 100)}%
                      </div>
                    )}

                    {riskModuleData.standard7.totalActivities === 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        ⚠️ Henüz risk faaliyeti tanımlanmamış. Lütfen Risk Modülünde faaliyet tanımlamaya başlayın.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Açıklama</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{action.description || 'Açıklama girilmemiş.'}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Beklenen Çıktılar</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{action.expected_output || 'Beklenen çıktı girilmemiş.'}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Gerekli Kaynaklar</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{action.required_resources || 'Kaynak bilgisi girilmemiş.'}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Sorumluluklar</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Sorumlu Birim:</span>
                    <span className="text-slate-900">{action.departments?.name || '-'}</span>
                  </div>
                  {action.special_responsible_type && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-600 font-medium">Özel Sorumlu:</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                        {
                          action.special_responsible_type === 'TOP_MANAGEMENT' ? 'Üst Yönetim (Başkan/Genel Sekreter/Genel Müdür)' :
                          action.special_responsible_type === 'INTERNAL_AUDITOR' ? 'İç Denetçi / İç Denetim Birimi' :
                          action.special_responsible_type === 'ETHICS_COMMITTEE' ? 'Etik Komisyonu' :
                          action.special_responsible_type === 'IT_COORDINATOR' ? 'Bilgi Teknolojileri Koordinatörü' :
                          action.special_responsible_type === 'HR_COORDINATOR' ? 'İnsan Kaynakları Koordinatörü' :
                          action.special_responsible_type === 'QUALITY_MANAGER' ? 'Kalite Yönetim Temsilcisi' :
                          action.special_responsible_type === 'RISK_COORDINATOR' ? 'Risk Koordinatörü' :
                          action.special_responsible_type === 'STRATEGY_COORDINATOR' ? 'Strateji Geliştirme Koordinatörü' :
                          action.special_responsible_type === 'OTHER' ? action.special_responsible :
                          action.special_responsible_type
                        }
                      </span>
                    </div>
                  )}
                  {relatedDepartments.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-600 font-medium">İlgili Birimler:</span>
                      <div className="flex flex-wrap gap-2">
                        {relatedDepartments.map((dept) => (
                          <span key={dept.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                            {dept.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {action.metadata?.related_special_responsible_types && action.metadata.related_special_responsible_types.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-600 font-medium">İlgili Özel Roller:</span>
                      <div className="flex flex-wrap gap-2">
                        {action.metadata.related_special_responsible_types.map((roleType: string) => (
                          <span key={roleType} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm">
                            {
                              roleType === 'TOP_MANAGEMENT' ? 'Üst Yönetim' :
                              roleType === 'INTERNAL_AUDITOR' ? 'İç Denetçi' :
                              roleType === 'ETHICS_COMMITTEE' ? 'Etik Komisyonu' :
                              roleType === 'IT_COORDINATOR' ? 'BT Koordinatörü' :
                              roleType === 'HR_COORDINATOR' ? 'İK Koordinatörü' :
                              roleType === 'QUALITY_MANAGER' ? 'Kalite Yöneticisi' :
                              roleType === 'RISK_COORDINATOR' ? 'Risk Koordinatörü' :
                              roleType === 'STRATEGY_COORDINATOR' ? 'Strateji Koordinatörü' :
                              roleType
                            }
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-4">
              {progressHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Henüz ilerleme kaydı bulunmuyor
                </div>
              ) : (
                progressHistory.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`border border-slate-200 rounded-lg p-4 ${
                      index === 0 ? 'bg-green-50 border-green-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-slate-900">
                          {new Date(entry.report_date).toLocaleDateString('tr-TR')} - {entry.profiles?.full_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">İlerleme:</span>
                          <span className="font-bold text-green-600">{entry.new_progress}%</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteProgress(entry.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                            title="İlerleme kaydını sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Açıklama:</div>
                        <p className="text-sm text-slate-700">{entry.description}</p>
                      </div>
                      {entry.challenges && (
                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-1">Karşılaşılan Sorunlar:</div>
                          <p className="text-sm text-slate-700">{entry.challenges}</p>
                        </div>
                      )}
                      {entry.next_steps && (
                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-1">Sonraki Adımlar:</div>
                          <p className="text-sm text-slate-700">{entry.next_steps}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Upload className="w-4 h-4" />
                  Belge Yükle
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Henüz belge yüklenmemiş
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Belge Adı</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tür</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Boyut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Yükleyen</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="text-sm text-slate-900">{doc.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {getFileTypeLabel(doc.file_type)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatFileSize(doc.file_size)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {doc.profiles?.full_name}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleDownloadDocument(doc)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="İndir"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-6">
              {linkedRisk && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">İlişkili Risk:</h3>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-700">
                      {linkedRisk.code} - {linkedRisk.name}
                    </span>
                    <button
                      onClick={() => navigateTo(`risk-management/risks/${linkedRisk.id}`)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {linkedControl && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">İlişkili Risk Kontrolü:</h3>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-700">
                      {linkedControl.name}
                    </span>
                    <button
                      onClick={() => navigateTo(`risk-management/controls/${linkedControl.id}`)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {linkedActivity && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">İlişkili Risk Faaliyeti:</h3>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-700">
                      {linkedActivity.code} - {linkedActivity.title}
                    </span>
                    <button
                      onClick={() => navigateTo(`risk-management/treatments/${linkedActivity.id}`)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {linkedGoal && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">İlişkili Stratejik Hedef:</h3>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-700">
                      {linkedGoal.code} - {linkedGoal.title}
                    </span>
                    <button
                      onClick={() => navigateTo(`goals/${linkedGoal.id}`)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {!linkedRisk && !linkedControl && !linkedActivity && !linkedGoal && (
                <div className="text-center py-12 text-slate-500">
                  Bu eylem için ilişkilendirme yapılmamış
                </div>
              )}
            </div>
          )}

          {activeTab === 'risk_treatments' && (
            <div className="space-y-4">
              {linkedRiskTreatments.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-600">
                      Bu İç Kontrol eylemine <span className="font-semibold text-green-600">{linkedRiskTreatments.length}</span> risk faaliyeti bağlanmıştır.
                    </p>
                    <button
                      onClick={() => navigateTo('risk-management/treatments')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Risk Faaliyetlerine Git
                    </button>
                  </div>

                  <div className="space-y-3">
                    {linkedRiskTreatments.map((treatment: any) => {
                      const statusColors: Record<string, string> = {
                        'NOT_STARTED': 'bg-gray-100 text-gray-800',
                        'IN_PROGRESS': 'bg-blue-100 text-blue-800',
                        'COMPLETED': 'bg-green-100 text-green-800',
                        'DELAYED': 'bg-red-100 text-red-800',
                        'CANCELLED': 'bg-gray-200 text-gray-700'
                      };

                      const statusLabels: Record<string, string> = {
                        'NOT_STARTED': 'Başlamadı',
                        'IN_PROGRESS': 'Devam Ediyor',
                        'COMPLETED': 'Tamamlandı',
                        'DELAYED': 'Gecikmiş',
                        'CANCELLED': 'İptal'
                      };

                      return (
                        <div key={treatment.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-green-300 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {treatment.code} - {treatment.title}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[treatment.status] || 'bg-gray-100 text-gray-800'}`}>
                                  {statusLabels[treatment.status] || treatment.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                                <div>
                                  <span className="font-medium">İlişkili Risk:</span>
                                  <div className="text-slate-700">{treatment.risk?.code} - {treatment.risk?.name}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Sorumlu Birim:</span>
                                  <div className="text-slate-700">{treatment.responsible_department?.name || '-'}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Hedef Tarih:</span>
                                  <div className="text-slate-700">
                                    {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium">İlerleme:</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                                      <div
                                        className="bg-green-600 h-2 rounded-full transition-all"
                                        style={{ width: `${treatment.progress_percent || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-slate-700 font-medium">{treatment.progress_percent || 0}%</span>
                                  </div>
                                </div>
                              </div>

                              {treatment.description && (
                                <div className="mt-2 text-sm text-slate-600">
                                  <span className="font-medium">Açıklama:</span> {treatment.description}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => navigateTo('risk-management/treatments')}
                              className="text-green-600 hover:text-green-700 flex-shrink-0"
                              title="Risk faaliyetine git"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Bu İç Kontrol eylemine henüz risk faaliyeti bağlanmamış
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="İlerleme Ekle"
      >
        <form onSubmit={handleSubmitProgress} className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
            <div className="text-sm">
              <div className="font-semibold text-slate-900 mb-2">
                {action?.code} - {action?.title}
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                <div>Mevcut İlerleme: <span className="font-medium text-slate-900">{action?.progress_percent || 0}%</span></div>
                <div>Mevcut Durum: <span className="font-medium text-slate-900">{getStatusLabel(action?.status || '')}</span></div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Yeni İlerleme (%) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <input
                type="range"
                required
                min="0"
                max="100"
                value={progressForm.new_progress}
                onChange={(e) => setProgressForm({ ...progressForm, new_progress: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>0</span>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={progressForm.new_progress}
                  onChange={(e) => setProgressForm({ ...progressForm, new_progress: parseInt(e.target.value) || 0 })}
                  className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <span>100</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Yeni Durum <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={progressForm.new_status}
              onChange={(e) => setProgressForm({ ...progressForm, new_status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              <option value="NOT_STARTED">Başlamadı</option>
              <option value="IN_PROGRESS">Devam Ediyor</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="DELAYED">Gecikmiş</option>
              <option value="ON_HOLD">Beklemede</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={progressForm.description}
              onChange={(e) => setProgressForm({ ...progressForm, description: e.target.value })}
              placeholder="Yapılan çalışmaları açıklayın..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Karşılaşılan Sorunlar
            </label>
            <textarea
              rows={2}
              value={progressForm.challenges}
              onChange={(e) => setProgressForm({ ...progressForm, challenges: e.target.value })}
              placeholder="Varsa sorunları belirtin..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sonraki Adımlar
            </label>
            <textarea
              rows={2}
              value={progressForm.next_steps}
              onChange={(e) => setProgressForm({ ...progressForm, next_steps: e.target.value })}
              placeholder="Planlanan sonraki adımlar..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Belge Ekle
            </label>
            <input
              type="file"
              onChange={(e) => setProgressForm({ ...progressForm, attachment: e.target.files?.[0] || null })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
            {progressForm.attachment && (
              <div className="mt-2 text-xs text-slate-600">
                Seçilen dosya: {progressForm.attachment.name} ({formatFileSize(progressForm.attachment.size)})
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowProgressModal(false)}
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

      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Belge Yükle"
      >
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dosya <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              required
              onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Belge Türü <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={uploadForm.file_type}
              onChange={(e) => setUploadForm({ ...uploadForm, file_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="document">Doküman</option>
              <option value="report">Rapor</option>
              <option value="procedure">Prosedür</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          {uploadProgress > 0 && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Yükleniyor: {Math.round(uploadProgress)}%</div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-full rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </div>
        </form>
      </Modal>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div
            className={`px-6 py-4 rounded-lg shadow-lg border ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
