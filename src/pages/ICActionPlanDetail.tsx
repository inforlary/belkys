import { useEffect } from 'react';
import { useLocation } from '../hooks/useLocation';

export default function ICActionPlanDetail() {
  const { navigate, currentPath } = useLocation();
  const planId = currentPath.split('/').pop() || '';

  useEffect(() => {
    navigate(`/internal-control/standards?plan_id=${planId}`);
  }, [planId, navigate]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Yönlendiriliyor...</div>
    </div>
  );
}
