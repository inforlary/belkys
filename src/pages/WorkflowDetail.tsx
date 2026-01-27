import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Download, AlertTriangle, Calendar, User, Building2 } from 'lucide-react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { WorkflowProcess, WorkflowActor, WorkflowStep, STATUS_LABELS, STATUS_COLORS } from '../types/workflow';
import { useWorkflowLayout } from '../hooks/useWorkflowLayout';
import { generateWorkflowPDF } from '../utils/workflowPDF';
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
  const id = currentPath.split('/').pop();
  const [workflow, setWorkflow] = useState<WorkflowProcess | null>(null);
  const [actors, setActors] = useState<WorkflowActor[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflow_processes')
        .select('*, departments(name)')
        .eq('id', id)
        .single();

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
        <div className="text-gray-500">İş akış şeması bulunamadı</div>
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
          <button
            onClick={() => navigate(`/workflows/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-5 h-5" />
            Düzenle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Süreç Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Ana Süreç:</span>
                <p className="font-medium text-gray-900 mt-1">{workflow.main_process || '-'}</p>
              </div>
              <div>
                <span className="text-gray-600">Süreç:</span>
                <p className="font-medium text-gray-900 mt-1">{workflow.process || '-'}</p>
              </div>
              <div>
                <span className="text-gray-600">Alt Süreç:</span>
                <p className="font-medium text-gray-900 mt-1">{workflow.sub_process || '-'}</p>
              </div>
              <div>
                <span className="text-gray-600">Versiyon:</span>
                <p className="font-medium text-gray-900 mt-1">v{workflow.version}</p>
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
        </div>
      </div>
    </div>
  );
}
