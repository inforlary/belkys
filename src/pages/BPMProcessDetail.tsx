import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  ArrowLeft, Edit2, Trash2, CheckCircle, XCircle, Power, PowerOff,
  FileText, Users, Target, GitMerge, AlertTriangle, Clock, User
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';

interface ProcessDetail {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  level: number;
  purpose: string;
  scope: string;
  start_event: string;
  end_event: string;
  inputs: string[];
  outputs: string[];
  human_resource: string;
  technological_resource: string;
  financial_resource: string;
  revision_no: number;
  revision_date: string;
  created_at: string;
  created_by: string;
  category: {
    code: string;
    name: string;
    color: string;
  };
  owner_department: {
    name: string;
  } | null;
  responsible_person: {
    full_name: string;
  } | null;
  strategic_goal: {
    code: string;
    name: string;
  } | null;
  workflow_process: {
    code: string;
    name: string;
  } | null;
  regulations: any[];
  process_risks: any[];
}

const statusConfig = {
  draft: { label: 'Taslak', color: 'gray' },
  pending_approval: { label: 'Onay Bekliyor', color: 'yellow' },
  approved: { label: 'Onaylandı', color: 'blue' },
  rejected: { label: 'Reddedildi', color: 'red' },
  active: { label: 'Aktif', color: 'green' },
  inactive: { label: 'Pasif', color: 'orange' }
};

export default function BPMProcessDetail() {
  const { currentPath, navigate } = useLocation();
  const id = currentPath.split('/').pop();
  const { user, profile } = useAuth();
  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [approvalLogs, setApprovalLogs] = useState<any[]>([]);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isDirector = profile?.role === 'director';

  useEffect(() => {
    if (id && profile?.organization_id) {
      fetchProcess();
      fetchHistory();
      fetchApprovalLogs();
    }
  }, [id, profile]);

  const fetchProcess = async () => {
    try {
      const { data, error } = await supabase
        .from('bpm_processes')
        .select(`
          *,
          category:bpm_categories(code, name, color),
          owner_department:departments(name),
          responsible_person:profiles(full_name),
          strategic_goal:goals(code, name),
          workflow_process:workflow_processes(code, name),
          regulations:bpm_process_regulations(*),
          process_risks:bpm_process_risks(
            risk:risks(code, name, current_level)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setProcess(data as any);
    } catch (error) {
      console.error('Error fetching process:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('bpm_process_history')
      .select(`
        *,
        changed_by_profile:profiles(full_name)
      `)
      .eq('process_id', id)
      .order('changed_at', { ascending: false });

    if (data) setHistory(data);
  };

  const fetchApprovalLogs = async () => {
    const { data } = await supabase
      .from('bpm_approval_logs')
      .select(`
        *,
        performed_by_profile:profiles(full_name)
      `)
      .eq('process_id', id)
      .order('performed_at', { ascending: false });

    if (data) setApprovalLogs(data);
  };

  const handleDelete = async () => {
    if (!confirm('Bu süreci silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('bpm_processes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      navigate('/process-management/list');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleApproval = async () => {
    if (approvalAction === 'reject' && !approvalNotes.trim()) {
      alert('Red nedeni girmelisiniz');
      return;
    }

    try {
      const updates: any = {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      };

      if (approvalAction === 'reject') {
        updates.rejection_reason = approvalNotes;
      }

      const { error } = await supabase
        .from('bpm_processes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setShowApprovalModal(false);
      setApprovalNotes('');
      fetchProcess();
      fetchApprovalLogs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleActivate = async () => {
    if (!confirm('Bu süreci aktif hale getirmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('bpm_processes')
        .update({ status: 'active' })
        .eq('id', id);

      if (error) throw error;
      fetchProcess();
      fetchApprovalLogs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Bu süreci pasif hale getirmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('bpm_processes')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) throw error;
      fetchProcess();
      fetchApprovalLogs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="text-center py-12">
        <p>Süreç bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('process-management/list')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{process.code}</h1>
              <StatusBadge
                status={process.status}
                label={statusConfig[process.status as keyof typeof statusConfig].label}
              />
            </div>
            <p className="mt-1 text-lg text-gray-600">{process.name}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isAdmin && process.status === 'pending_approval' && (
            <>
              <Button
                onClick={() => {
                  setApprovalAction('approve');
                  setShowApprovalModal(true);
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Onayla
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setApprovalAction('reject');
                  setShowApprovalModal(true);
                }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reddet
              </Button>
            </>
          )}

          {isAdmin && process.status === 'approved' && (
            <Button onClick={handleActivate}>
              <Power className="w-4 h-4 mr-2" />
              Aktif Et
            </Button>
          )}

          {isAdmin && process.status === 'active' && (
            <Button variant="outline" onClick={handleDeactivate}>
              <PowerOff className="w-4 h-4 mr-2" />
              Pasif Et
            </Button>
          )}

          {(isAdmin || isDirector) && ['draft', 'rejected'].includes(process.status) && (
            <>
              <Button variant="outline" onClick={() => navigate(`process-management/${id}/edit`)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Düzenle
              </Button>
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex gap-8 px-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Genel Bilgiler
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Revizyon Geçmişi
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'approvals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Onay Geçmişi
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Kategori</h3>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: process.category.color }}
                    />
                    <p className="text-gray-900">{process.category.name}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Seviye</h3>
                  <p className="text-gray-900">Seviye {process.level}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Sorumlu Birim</h3>
                  <p className="text-gray-900">{process.owner_department?.name || '-'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Sorumlu Kişi</h3>
                  <p className="text-gray-900">{process.responsible_person?.full_name || '-'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Revizyon</h3>
                  <p className="text-gray-900">v{process.revision_no}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Oluşturulma Tarihi</h3>
                  <p className="text-gray-900">
                    {new Date(process.created_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>

              {process.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Açıklama</h3>
                  <p className="text-gray-900">{process.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {process.purpose && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Amaç</h3>
                    <p className="text-gray-900 whitespace-pre-wrap">{process.purpose}</p>
                  </div>
                )}

                {process.scope && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Kapsam</h3>
                    <p className="text-gray-900 whitespace-pre-wrap">{process.scope}</p>
                  </div>
                )}
              </div>

              {(process.start_event || process.end_event) && (
                <div className="grid grid-cols-2 gap-6">
                  {process.start_event && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Başlangıç Olayı</h3>
                      <p className="text-gray-900">{process.start_event}</p>
                    </div>
                  )}

                  {process.end_event && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Bitiş Olayı</h3>
                      <p className="text-gray-900">{process.end_event}</p>
                    </div>
                  )}
                </div>
              )}

              {process.inputs && process.inputs.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Girdiler</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {process.inputs.map((input, index) => (
                      <li key={index} className="text-gray-900">{input}</li>
                    ))}
                  </ul>
                </div>
              )}

              {process.outputs && process.outputs.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Çıktılar</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {process.outputs.map((output, index) => (
                      <li key={index} className="text-gray-900">{output}</li>
                    ))}
                  </ul>
                </div>
              )}

              {process.regulations && process.regulations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Yasal Dayanak</h3>
                  <div className="space-y-2">
                    {process.regulations.map((reg, index) => (
                      <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-blue-600">{reg.regulation_type}</span>
                        <span className="text-sm text-gray-900">{reg.name}</span>
                        {reg.related_articles && (
                          <span className="text-sm text-gray-500">({reg.related_articles})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {process.process_risks && process.process_risks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">İlişkili Riskler</h3>
                  <div className="space-y-2">
                    {process.process_risks.map((pr: any, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-mono font-medium text-gray-600">
                          {pr.risk.code}
                        </span>
                        <span className="text-sm text-gray-900 flex-1">{pr.risk.name}</span>
                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                          {pr.risk.current_level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {process.strategic_goal && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Stratejik Hedef</h3>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Target className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-mono font-medium text-gray-600">
                      {process.strategic_goal.code}
                    </span>
                    <span className="text-sm text-gray-900">{process.strategic_goal.name}</span>
                  </div>
                </div>
              )}

              {process.workflow_process && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">İş Akışı Şeması</h3>
                  <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                    <GitMerge className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-mono font-medium text-gray-600">
                      {process.workflow_process.code}
                    </span>
                    <span className="text-sm text-gray-900">{process.workflow_process.name}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {history.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Henüz revizyon geçmişi yok</p>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">Revizyon {item.revision_no}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(item.changed_at).toLocaleString('tr-TR')}
                          </p>
                        </div>
                        {item.change_description && (
                          <p className="text-sm text-gray-600 mt-1">{item.change_description}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Değiştiren: {item.changed_by_profile?.full_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'approvals' && (
            <div>
              {approvalLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Henüz onay geçmişi yok</p>
              ) : (
                <div className="space-y-4">
                  {approvalLogs.map((log) => (
                    <div key={log.id} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          {log.action === 'approved' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {log.action === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
                          {log.action === 'submitted' && <Clock className="w-5 h-5 text-yellow-600" />}
                          {log.action === 'activated' && <Power className="w-5 h-5 text-blue-600" />}
                          {log.action === 'deactivated' && <PowerOff className="w-5 h-5 text-gray-600" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">
                            {log.action === 'submitted' && 'Onaya Gönderildi'}
                            {log.action === 'approved' && 'Onaylandı'}
                            {log.action === 'rejected' && 'Reddedildi'}
                            {log.action === 'activated' && 'Aktif Edildi'}
                            {log.action === 'deactivated' && 'Pasif Edildi'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(log.performed_at).toLocaleString('tr-TR')}
                          </p>
                        </div>
                        {log.notes && (
                          <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                        )}
                        {log.performed_by_profile && (
                          <p className="text-sm text-gray-500 mt-1">
                            {log.performed_by_profile.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setApprovalNotes('');
        }}
        title={approvalAction === 'approve' ? 'Süreci Onayla' : 'Süreci Reddet'}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {approvalAction === 'approve'
              ? 'Bu süreci onaylamak istediğinizden emin misiniz?'
              : 'Bu süreci reddetmek istediğinizden emin misiniz?'}
          </p>

          {approvalAction === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Red Nedeni *
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Reddetme nedeninizi açıklayın..."
                required
              />
            </div>
          )}

          {approvalAction === 'approve' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Not (İsteğe Bağlı)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Varsa not ekleyin..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowApprovalModal(false);
                setApprovalNotes('');
              }}
            >
              İptal
            </Button>
            <Button onClick={handleApproval}>
              {approvalAction === 'approve' ? 'Onayla' : 'Reddet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}