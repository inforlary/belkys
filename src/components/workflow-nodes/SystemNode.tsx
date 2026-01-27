import { Handle, Position, NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';

interface SystemNodeData {
  label: string;
  isSensitive?: boolean;
}

export default function SystemNode({ data }: NodeProps<SystemNodeData>) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-purple-600" />
      <div className="min-w-[160px] max-w-[240px] bg-purple-500 text-white rounded-lg shadow-lg border-2 border-purple-600 overflow-hidden">
        <div className="h-2 bg-purple-700"></div>
        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            {data.isSensitive && (
              <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium leading-tight break-words">{data.label}</p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-600" />
    </div>
  );
}
