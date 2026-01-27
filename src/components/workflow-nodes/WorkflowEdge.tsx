import { EdgeProps, getStraightPath, EdgeLabelRenderer } from '@xyflow/react';

export default function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.type;
  const strokeColor = edgeType === 'yes' ? '#10b981' : edgeType === 'no' ? '#ef4444' : '#64748b';
  const labelText = edgeType === 'yes' ? 'EVET' : edgeType === 'no' ? 'HAYIR' : label;
  const labelBgColor = edgeType === 'yes' ? 'bg-green-100 text-green-800' : edgeType === 'no' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: 2,
        }}
      />
      {labelText && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className={`px-2 py-1 text-xs font-bold rounded shadow-sm border ${labelBgColor}`}>
              {labelText}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
