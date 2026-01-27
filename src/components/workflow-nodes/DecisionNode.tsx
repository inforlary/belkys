import { Handle, Position, NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';

interface DecisionNodeData {
  label: string;
  isSensitive?: boolean;
}

export default function DecisionNode({ data }: NodeProps<DecisionNodeData>) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-orange-600" />
      <div className="relative min-w-[160px] max-w-[240px]">
        <div className="relative bg-orange-500 text-white shadow-lg border-2 border-orange-600"
             style={{
               clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
               padding: '40px 50px'
             }}>
          <div className="flex items-start justify-center gap-2 text-center" style={{ transform: 'translateY(-2px)' }}>
            {data.isSensitive && (
              <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
            )}
            <p className="text-sm font-medium leading-tight break-words">{data.label}</p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="yes" className="!bg-green-600" />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-600" />
    </div>
  );
}
