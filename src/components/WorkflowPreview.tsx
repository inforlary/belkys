import { useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowActor, WorkflowStep } from '../types/workflow';
import { useWorkflowLayout } from '../hooks/useWorkflowLayout';
import StartNode from './workflow-nodes/StartNode';
import EndNode from './workflow-nodes/EndNode';
import ProcessNode from './workflow-nodes/ProcessNode';
import DecisionNode from './workflow-nodes/DecisionNode';
import DocumentNode from './workflow-nodes/DocumentNode';
import SystemNode from './workflow-nodes/SystemNode';
import WorkflowEdge from './workflow-nodes/WorkflowEdge';

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

interface WorkflowPreviewProps {
  actors: Omit<WorkflowActor, 'id' | 'workflow_id' | 'created_at'>[];
  steps: Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at'>[];
}

export default function WorkflowPreview({ actors, steps }: WorkflowPreviewProps) {
  const actorsWithId = actors.map((a, i) => ({
    ...a,
    id: `temp-${i}`,
    workflow_id: 'preview',
    created_at: new Date().toISOString()
  }));

  const stepsWithId = steps.map((s, i) => ({
    ...s,
    id: `step-${i}`,
    workflow_id: 'preview',
    created_at: new Date().toISOString()
  }));

  const { nodes: layoutNodes, edges: layoutEdges, swimlanes } = useWorkflowLayout(actorsWithId, stepsWithId);
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  if (actors.length === 0 || steps.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <p className="text-gray-500 font-medium mb-2">Henüz önizleme yok</p>
          <p className="text-gray-400 text-sm">
            {actors.length === 0 ? 'Görevli ekleyin' : 'İş adımı ekleyin'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
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

      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3 max-w-xs">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Görevliler</h4>
        <div className="space-y-1">
          {actors.map((actor, index) => (
            <div key={index} className="text-xs text-gray-600 flex items-start gap-2">
              <span className="font-mono text-gray-400">{index + 1}.</span>
              <span>{actor.title || 'İsimsiz'} - {actor.department}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
