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
  const navigate = useLocation();
  const pathParts = window.location.pathname.split('/');
  const planId = pathParts[pathParts.indexOf('action-plans') + 1];
  const actionId = pathParts[pathParts.length - 1];

  const [action, setAction] = useState<Action | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressEntry[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [relatedDepartments, setRelatedDepartments] = useState<any[]>([]);
  const [linkedRisk, setLinkedRisk] = useState<any>(null);
  const [linkedGoal, setLinkedGoal] = useState<any>(null);
  const [linkedControl, setLinkedControl] = useState<any>(null);
  const [linkedActivity, setLinkedActivity] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'progress' | 'documents' | 'relations'>('details');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [progressForm, setProgressForm] = useState({
    new_progress: 0,
    new_status: '',
    description: '',
    challenges: '',
    next_steps: ''
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
            .from('risk_register')
            .select('id, code, title')
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
            .from('ic_controls')
            .select('id, code, title')
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

      const { error: updateError } = await supabase
        .from('ic_actions')
        .update({
          progress_percent: progressForm.new_progress,
          status: progressForm.new_status
        })
        .eq('id', actionId);

      if (updateError) throw updateError;

      setShowProgressModal(false);
      setProgressForm({
        new_progress: 0,
        new_status: '',
        description: '',
        challenges: '',
        next_steps: ''
      });
      loadData();
    } catch (error) {
      console.error('İlerleme kaydedilirken hata:', error);
      alert('İlerleme kaydedilirken bir hata oluştu');
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      NOT_STARTED: 'bg-slate-100 text-slate-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DELAYED: 'bg-red-100 text-red-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800'
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOT_STARTED: 'Başlamadı',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      DELAYED: 'Gecikmiş',
      ON_HOLD: 'Beklemede'
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
          onClick={() => navigate(`/internal-control/action-plans/${planId}`)}
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
              onClick={() => navigate(`/internal-control/action-plans/${planId}/actions/${actionId}/edit`)}
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
              { id: 'relations', label: 'İlişkiler' }
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Sorumlu Birim:</span>
                    <span className="text-slate-900">{action.departments?.name}</span>
                  </div>
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">İlerleme:</span>
                        <span className="font-bold text-green-600">{entry.new_progress}%</span>
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
                      {linkedRisk.code} - {linkedRisk.title}
                    </span>
                    <button
                      onClick={() => navigate(`/risk-management/register/${linkedRisk.id}`)}
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
                      {linkedControl.code} - {linkedControl.title}
                    </span>
                    <button
                      onClick={() => navigate(`/internal-control/controls/${linkedControl.id}`)}
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
                      onClick={() => navigate(`/risk-management/treatments/${linkedActivity.id}`)}
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
                      onClick={() => navigate(`/goals/${linkedGoal.id}`)}
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
        </div>
      </div>

      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="İlerleme Ekle"
      >
        <form onSubmit={handleSubmitProgress} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Yeni İlerleme (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                max="100"
                value={progressForm.new_progress}
                onChange={(e) => setProgressForm({ ...progressForm, new_progress: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
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
              </select>
            </div>
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
    </div>
  );
}
