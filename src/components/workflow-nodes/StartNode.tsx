import { Handle, Position } from '@xyflow/react';

export default function StartNode() {
  return (
    <div className="relative">
      <div className="px-6 py-3 bg-green-500 text-white rounded-full font-semibold shadow-lg border-2 border-green-600">
        BAŞLA
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-600" />
    </div>
  );
}
