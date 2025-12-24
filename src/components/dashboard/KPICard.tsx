import { LucideIcon } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
  subtitle?: string;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500'
};

const bgColorClasses = {
  blue: 'bg-blue-50',
  green: 'bg-green-50',
  yellow: 'bg-yellow-50',
  red: 'bg-red-50',
  purple: 'bg-purple-50',
  orange: 'bg-orange-50'
};

export default function KPICard({ title, value, change, icon: Icon, color, subtitle }: KPICardProps) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            {change !== undefined && (
              <div className="flex items-center mt-2">
                <span className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
                </span>
                <span className="text-xs text-gray-500 ml-2">önceki döneme göre</span>
              </div>
            )}
          </div>
          <div className={`${bgColorClasses[color]} p-4 rounded-lg`}>
            <Icon className={`w-8 h-8 ${colorClasses[color].replace('bg-', 'text-')}`} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
