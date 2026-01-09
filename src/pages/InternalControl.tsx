import { useEffect } from 'react';
import { useLocation } from '../hooks/useLocation';

export default function InternalControl() {
  const { navigate } = useLocation();

  useEffect(() => {
    navigate('/internal-control/dashboard');
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Yönlendiriliyor...</div>
    </div>
  );
}
