import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Download, AlertTriangle, Calendar, User, Building2, CheckCircle, XCircle, Trash2, Send } from 'lucide-react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { WorkflowProcess, WorkflowActor, WorkflowStep, STATUS_LABELS, STATUS_COLORS } from '../types/workflow';
import { useWorkflowLayout } from '../hooks/useWorkflowLayout';
import { generateWorkflowPDF } from '../utils/workflowPDF';
import Modal from '../components/ui/Modal';
import StartNode from '../components/workflow-nodes/StartNode';
import EndNode from '../components/workflow-nodes/EndNode';
import ProcessNode from '../components/workflow-nodes/ProcessNode';
import DecisionNode from '../components/workflow-nodes/DecisionNode';
import DocumentNode from '../components/workflow-nodes/DocumentNode';
import SystemNode from '../components/workflow-nodes/SystemNode';
import WorkflowEdge from '../components/workflow-nodes/WorkflowEdge';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
  document: DocumentNode,
  system: SystemNode,
};

const edgeTypes = {
  workflow: WorkflowEdge,
};

export default function WorkflowDetail() {
  const { navigate, currentPath } = useLocation();
  const { user, profile } = useAuth();
  const id = currentPath.split('/').pop();
  const [workflow, setWorkflow] = useState<WorkflowProcess | null>(null);
  const [actors, setActors] = useState<WorkflowActor[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { nodes: layoutNodes, edges: layoutEdges, swimlanes } = useWorkflowLayout(actors, steps);
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    if (id) {
      fetchWorkflowData();
    }
  }, [id]);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  async function fetchWorkflowData() {
    try {
      console.log('Fetching workflow with ID:', id);

      const { data: workflowData, error: workflowError } = await supabase
        .from('workflow_processes')
        .select('*, departments(name), bpm_processes(id, code, name), qm_processes(id, code, name, qm_process_categories(name))')
        .eq('id', id)
        .single();

      console.log('Workflow data:', workflowData);
      console.log('Workflow error:', workflowError);

      if (workflowError) throw workflowError;
      setWorkflow(workflowData);

      const { data: actorsData, error: actorsError } = await supabase
        .from('workflow_actors')
        .select('*')
        .eq('workflow_id', id)
        .order('order_index');

      if (actorsError) throw actorsError;
      setActors(actorsData || []);

      const { data: stepsData, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('workflow_id', id)
        .order('order_index');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);
    } catch (error) {
      console.error('Error fetching workflow:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadPDF = () => {
    if (workflow && actors && steps) {
      generateWorkflowPDF(workflow, actors, steps);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!workflow) return;
    try {
      const { error } = await supabase
        .from('workflow_processes')
        .update({
          status: 'pending_approval',
          updated_at: new Date().toISOString()
        })
        .eq('id', workflow.id);

      if (error) throw error;
      alert('İş akışı onaya gönderildi');
      fetchWorkflowData();
    } catch (error) {
      console.error('Error submitting workflow:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleApprove = async () => {
    if (!workflow || !user) return;
    try {
      const { error } = await supabase
        .from('workflow_processes')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', workflow.id);

      if (error) throw error;
      alert('İş akışı onaylandı');
      fetchWorkflowData();
    } catch (error) {
      console.error('Error approving workflow:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleReject = async () => {
    if (!workflow || !user || !rejectionReason.trim()) {
      alert('Lütfen red nedeni giriniz');
      return;
    }
    try {
      const { error } = await supabase
        .from('workflow_processes')
        .update({
          status: 'draft',
          rejection_reason: rejectionReason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', workflow.id);

      if (error) throw error;
      alert('İş akışı reddedildi');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchWorkflowData();
    } catch (error) {
      console.error('Error rejecting workflow:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleDelete = async () => {
    if (!workflow) return;
    try {
      const { error } = await supabase
        .from('workflow_processes')
        .delete()
        .eq('id', workflow.id);

      if (error) throw error;
      alert('İş akışı silindi');
      navigate('/workflows');
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Bir hata oluştu');
    }
  };

  const isAdmin = profile?.role?.toLowerCase() === 'admin' || profile?.is_super_admin;
  const isDirector = profile?.role?.toLowerCase() === 'director';
  const canApprove = isAdmin || isDirector;
  const canDelete = isAdmin || isDirector;
  const canEdit = workflow?.status === 'draft' || canApprove;

  const sensitiveSteps = steps.filter(s => s.is_sensitive);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <div className="text-gray-900 font-medium">İş akış şeması bulunamadı</div>
          <div className="text-sm text-gray-500">
            İş akışı silinmiş olabilir veya erişim yetkiniz olmayabilir.
          </div>
          <button
            onClick={() => navigate('/workflows')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            İş Akışları Listesine Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workflows')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-mono text-gray-500">{workflow.code}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[workflow.status]}`}>
                {STATUS_LABELS[workflow.status]}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{workflow.name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-5 h-5" />
            PDF İndir
          </button>

          {workflow.status === 'draft' && (
            <button
              onClick={handleSubmitForApproval}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Send className="w-5 h-5" />
              Onaya Gönder
            </button>
          )}

          {workflow.status === 'pending_approval' && canApprove && (
            <>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                Onayla
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <XCircle className="w-5 h-5" />
                Reddet
              </button>
            </>
          )}

          {canEdit && (
            <button
              onClick={() => navigate(`/workflows/edit/${id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit className="w-5 h-5" />
              Düzenle
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 className="w-5 h-5" />
              Sil
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Süreç Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(workflow as any).qm_processes && (
                <div className="col-span-2">
                  <span className="text-gray-600">İlişkili Kalite Süreci:</span>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/quality-processes`)}
                      className="font-medium text-green-600 hover:text-green-800 hover:underline"
                    >
                      {(workflow as any).qm_processes.code} - {(workflow as any).qm_processes.name}
                    </button>
                    {(workflow as any).qm_processes.qm_process_categories?.name && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                        {(workflow as any).qm_processes.qm_process_categories.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {(workflow as any).bpm_processes && (
                <div className="col-span-2">
                  <span className="text-gray-600">İlişkili Süreç:</span>
                  <div className="mt-1">
                    <button
                      onClick={() => navigate(`/bpm-processes/${(workflow as any).bpm_processes.id}`)}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {(workflow as any).bpm_processes.code} - {(workflow as any).bpm_processes.name}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <span className="text-gray-600">Versiyon:</span>
                <p className="font-medium text-gray-900 mt-1">v{workflow.version}</p>
              </div>
              <div>
                <span className="text-gray-600">Süreç Sahibi Birim:</span>
                <p className="font-medium text-gray-900 mt-1">{(workflow as any).departments?.name || '-'}</p>
              </div>
              {workflow.description && (
                <div className="col-span-2">
                  <span className="text-gray-600">Açıklama:</span>
                  <p className="font-medium text-gray-900 mt-1">{workflow.description}</p>
                </div>
              )}
              {workflow.trigger_event && (
                <div className="col-span-2">
                  <span className="text-gray-600">Başlatan Olay:</span>
                  <p className="font-medium text-gray-900 mt-1">{workflow.trigger_event}</p>
                </div>
              )}
              {workflow.outputs && (
                <div className="col-span-2">
                  <span className="text-gray-600">Çıktılar:</span>
                  <p className="font-medium text-gray-900 mt-1">{workflow.outputs}</p>
                </div>
              )}
              {workflow.software_used && (
                <div>
                  <span className="text-gray-600">Kullanılan Yazılımlar:</span>
                  <p className="font-medium text-gray-900 mt-1">{workflow.software_used}</p>
                </div>
              )}
              {workflow.legal_basis && (
                <div>
                  <span className="text-gray-600">Dayanak Mevzuat:</span>
                  <p className="font-medium text-gray-900 mt-1">{workflow.legal_basis}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">İş Akış Şeması</h2>
            </div>
            <div className="h-[700px]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                minZoom={0.3}
                maxZoom={1.5}
              >
                <Background />
                <Controls />
                <MiniMap
                  nodeColor={(node) => {
                    if (node.type === 'start') return '#10b981';
                    if (node.type === 'end') return '#ef4444';
                    if (node.type === 'process') return '#3b82f6';
                    if (node.type === 'decision') return '#f59e0b';
                    if (node.type === 'document') return '#10b981';
                    if (node.type === 'system') return '#8b5cf6';
                    return '#94a3b8';
                  }}
                  className="!bg-white !border !border-gray-200"
                />
              </ReactFlow>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Görevliler</h3>
            <div className="space-y-3">
              {actors.map((actor, index) => (
                <div key={actor.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{actor.title}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                      <Building2 className="w-3 h-3" />
                      <span>{actor.department}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                      <User className="w-3 h-3" />
                      <span>{actor.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {sensitiveSteps.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-orange-900">Hassas Görevler</h3>
              </div>
              <div className="space-y-2">
                {sensitiveSteps.map((step, index) => (
                  <div key={step.id} className="text-sm text-orange-800 flex items-start gap-2">
                    <span className="font-mono text-orange-600">{index + 1}.</span>
                    <span>{step.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Genel Bilgiler</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Oluşturulma: {new Date(workflow.created_at).toLocaleDateString('tr-TR')}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Güncellenme: {new Date(workflow.updated_at).toLocaleDateString('tr-TR')}</span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <span className="text-gray-600">Toplam Görevli:</span>
                <p className="font-medium text-gray-900 mt-1">{actors.length}</p>
              </div>
              <div>
                <span className="text-gray-600">Toplam Adım:</span>
                <p className="font-medium text-gray-900 mt-1">{steps.length}</p>
              </div>
              <div>
                <span className="text-gray-600">Hassas Görev:</span>
                <p className="font-medium text-gray-900 mt-1">{sensitiveSteps.length}</p>
              </div>
            </div>
          </div>

          {workflow.approved_at && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">Onay Bilgisi</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-green-700">Onay Tarihi:</span>
                  <p className="font-medium text-green-900 mt-1">
                    {new Date(workflow.approved_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {workflow.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-red-900">Red Nedeni</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-red-800">{workflow.rejection_reason}</p>
                {workflow.reviewed_at && (
                  <p className="text-red-600 text-xs mt-2">
                    {new Date(workflow.reviewed_at).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="İş Akışını Reddet">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Red Nedeni <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Lütfen reddetme nedeninizi açıklayın..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reddet
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="İş Akışını Sil">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 font-medium">Bu işlem geri alınamaz!</p>
              <p className="text-sm text-red-700 mt-1">
                İş akış şeması ve tüm ilişkili veriler kalıcı olarak silinecektir.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Sil
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
