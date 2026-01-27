import { useMemo } from 'react';
import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';
import { WorkflowActor, WorkflowStep } from '../types/workflow';

const SWIMLANE_HEIGHT = 150;
const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

export function useWorkflowLayout(
  actors: WorkflowActor[],
  steps: WorkflowStep[]
) {
  return useMemo(() => {
    if (actors.length === 0 || steps.length === 0) {
      return { nodes: [], edges: [], swimlanes: [] };
    }

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: 'TB',
      nodesep: 100,
      ranksep: 120,
      marginx: 50,
      marginy: 50
    });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
      id: 'start',
      type: 'start',
      data: { label: 'BAŞLA' },
      position: { x: 0, y: 0 },
    });
    dagreGraph.setNode('start', { width: NODE_WIDTH, height: 60 });

    steps.forEach((step, index) => {
      const actor = actors.find(a => a.id === step.actor_id);
      const nodeType = step.step_type === 'process' ? 'process' :
                       step.step_type === 'decision' ? 'decision' :
                       step.step_type === 'document' ? 'document' : 'system';

      nodes.push({
        id: step.id,
        type: nodeType,
        data: {
          label: step.description,
          isSensitive: step.is_sensitive,
          actorIndex: actor ? actors.findIndex(a => a.id === actor.id) : 0
        },
        position: { x: 0, y: 0 },
      });

      dagreGraph.setNode(step.id, {
        width: nodeType === 'decision' ? 240 : NODE_WIDTH,
        height: nodeType === 'decision' ? 120 : NODE_HEIGHT
      });

      if (index === 0) {
        edges.push({
          id: `start-${step.id}`,
          source: 'start',
          target: step.id,
          type: 'workflow',
        });
        dagreGraph.setEdge('start', step.id);
      } else {
        const prevStep = steps[index - 1];
        if (prevStep.step_type === 'decision') {
          if (prevStep.yes_target_step === step.id) {
            edges.push({
              id: `${prevStep.id}-${step.id}-yes`,
              source: prevStep.id,
              sourceHandle: 'yes',
              target: step.id,
              type: 'workflow',
              data: { type: 'yes' }
            });
            dagreGraph.setEdge(prevStep.id, step.id);
          } else if (prevStep.no_target_step === step.id) {
            edges.push({
              id: `${prevStep.id}-${step.id}-no`,
              source: prevStep.id,
              sourceHandle: 'no',
              target: step.id,
              type: 'workflow',
              data: { type: 'no' }
            });
            dagreGraph.setEdge(prevStep.id, step.id);
          }
        } else {
          edges.push({
            id: `${prevStep.id}-${step.id}`,
            source: prevStep.id,
            target: step.id,
            type: 'workflow',
          });
          dagreGraph.setEdge(prevStep.id, step.id);
        }
      }
    });

    nodes.push({
      id: 'end',
      type: 'end',
      data: { label: 'BİTİR' },
      position: { x: 0, y: 0 },
    });
    dagreGraph.setNode('end', { width: NODE_WIDTH, height: 60 });

    const lastStep = steps[steps.length - 1];
    edges.push({
      id: `${lastStep.id}-end`,
      source: lastStep.id,
      target: 'end',
      type: 'workflow',
    });
    dagreGraph.setEdge(lastStep.id, 'end');

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const actorIndex = node.data.actorIndex !== undefined ? node.data.actorIndex : 0;

      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (nodeWithPosition.width / 2),
          y: nodeWithPosition.y - (nodeWithPosition.height / 2) + (actorIndex * SWIMLANE_HEIGHT),
        },
      };
    });

    const swimlanes = actors.map((actor, index) => ({
      id: actor.id,
      title: actor.title,
      department: actor.department,
      y: index * SWIMLANE_HEIGHT,
      height: SWIMLANE_HEIGHT,
    }));

    return { nodes: layoutedNodes, edges, swimlanes };
  }, [actors, steps]);
}
