import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3 } from 'lucide-react';

export default function RiskIndicators() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadIndicators();
    }
  }, [profile?.organization_id]);

  const loadIndicators = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_indicators')
        .select(`
          *,
          risk:risks(code, name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-purple-600" />
          Risk Göstergeleri
        </h1>
        <p className="text-slate-600 mt-2">KRI ve LEI göstergeleri ile riskleri izleyin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gösterge Adı</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tür</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Birim</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Hedef</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {indicators.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  Henüz gösterge bulunmuyor
                </td>
              </tr>
            ) : (
              indicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {indicator.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">{indicator.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {indicator.risk?.code} - {indicator.risk?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      indicator.indicator_type === 'KRI' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {indicator.indicator_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {indicator.unit_of_measure || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-900">
                    {indicator.target_value || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
