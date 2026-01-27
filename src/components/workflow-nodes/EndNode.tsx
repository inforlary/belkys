import { Handle, Position } from '@xyflow/react';

export default function EndNode() {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-red-600" />
      <div className="px-6 py-3 bg-red-500 text-white rounded-full font-semibold shadow-lg border-2 border-red-600">
        BİTİR
      </div>
    </div>
  );
}
