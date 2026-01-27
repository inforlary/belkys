import { Handle, Position, NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';

interface ProcessNodeData {
  label: string;
  isSensitive?: boolean;
}

export default function ProcessNode({ data }: NodeProps<ProcessNodeData>) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-blue-600" />
      <div className="min-w-[160px] max-w-[240px] px-4 py-3 bg-blue-500 text-white rounded-lg shadow-lg border-2 border-blue-600">
        <div className="flex items-start gap-2">
          {data.isSensitive && (
            <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium leading-tight break-words">{data.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-600" />
    </div>
  );
}
