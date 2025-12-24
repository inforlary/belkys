import { AlertTriangle, Clock } from 'lucide-react';

interface Deadline {
  deadline_date: string;
  period_type: string;
  period_year: number;
  period_quarter?: number;
  period_month?: number;
}

interface DeadlineWarningProps {
  deadline: Deadline | null;
  hasReport: boolean;
  reportStatus?: string;
}

export default function DeadlineWarning({ deadline, hasReport, reportStatus }: DeadlineWarningProps) {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline.deadline_date);
  const today = new Date();
  const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline >= 0 && daysUntilDeadline <= 7;

  if (hasReport && reportStatus === 'approved') {
    return null;
  }

  if (isOverdue) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Rapor Süresi Geçti!</h3>
            <p className="text-sm text-red-700 mt-1">
              Son tarih {Math.abs(daysUntilDeadline)} gün önce doldu ({deadlineDate.toLocaleDateString('tr-TR')})
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isUrgent) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <Clock className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Son Tarih Yaklaşıyor</h3>
            <p className="text-sm text-yellow-700 mt-1">
              {daysUntilDeadline === 0 ? 'Bugün son gün!' : `${daysUntilDeadline} gün kaldı`}
              {' '}({deadlineDate.toLocaleDateString('tr-TR')})
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center text-sm text-blue-700">
        <Clock className="h-4 w-4 mr-2" />
        <span>Son tarih: {deadlineDate.toLocaleDateString('tr-TR')} ({daysUntilDeadline} gün)</span>
      </div>
    </div>
  );
}
