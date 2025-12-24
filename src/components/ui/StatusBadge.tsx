import { VoucherStatus, getStatusLabel, getStatusColor } from '../../utils/statusWorkflow';

interface StatusBadgeProps {
  status: VoucherStatus;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${getStatusColor(status)} ${sizeClasses[size]}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}
