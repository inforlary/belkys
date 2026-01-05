import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { RiskHeatMap } from '../components/RiskHeatMap';
import { ArrowLeft } from 'lucide-react';

interface Risk {
  id: string;
  risk_code: string;
  risk_title: string;
  inherent_likelihood: number;
  inherent_impact: number;
  residual_likelihood: number;
  residual_impact: number;
}

export default function RiskHeatMapPage() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'inherent' | 'residual'>('residual');

  useEffect(() => {
    if (profile?.organization_id) {
      loadRisks();
    }
  }, [profile]);

  const loadRisks = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('id, code, name, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true);

      if (error) throw error;

      const formattedRisks = (data || []).map(risk => ({
        id: risk.id,
        risk_code: risk.code,
        risk_title: risk.name,
        inherent_likelihood: risk.inherent_likelihood,
        inherent_impact: risk.inherent_impact,
        residual_likelihood: risk.residual_likelihood,
        residual_impact: risk.residual_impact
      }));

      setRisks(formattedRisks);
    } catch (error) {
      console.error('Riskler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-slate-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('risks')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Risk Isı Haritası</h1>
            <p className="text-slate-600">Risklerin görsel haritalandırması</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewType('residual')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'residual'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Artık Risk
          </button>
          <button
            onClick={() => setViewType('inherent')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'inherent'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Doğal Risk
          </button>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-slate-500">Henüz risk kaydı bulunmamaktadır.</p>
          <button
            onClick={() => navigate('risks/register')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Risk Ekle
          </button>
        </div>
      ) : (
        <RiskHeatMap risks={risks} type={viewType} />
      )}
    </div>
  );
}
