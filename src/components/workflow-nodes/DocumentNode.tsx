import { Handle, Position, NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';

interface DocumentNodeData {
  label: string;
  isSensitive?: boolean;
}

export default function DocumentNode({ data }: NodeProps<DocumentNodeData>) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-green-600" />
      <div className="min-w-[160px] max-w-[240px]">
        <svg width="100%" height="100%" viewBox="0 0 200 80" preserveAspectRatio="none" className="absolute inset-0">
          <path
            d="M 0,0 L 200,0 L 200,65 Q 150,75 100,65 Q 50,55 0,65 Z"
            fill="#10b981"
            stroke="#059669"
            strokeWidth="2"
          />
        </svg>
        <div className="relative px-4 py-3 text-white">
          <div className="flex items-start gap-2">
            {data.isSensitive && (
              <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium leading-tight break-words">{data.label}</p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-600" />
    </div>
  );
}
