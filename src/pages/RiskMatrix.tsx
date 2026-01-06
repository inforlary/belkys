import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Grid } from 'lucide-react';

export default function RiskMatrix() {
  const { profile } = useAuth();
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadRisks();
    }
  }, [profile?.organization_id]);

  const loadRisks = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('id, code, name, residual_likelihood, residual_impact, residual_score')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true);

      if (error) throw error;
      setRisks(data || []);
    } catch (error) {
      console.error('Riskler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRisksInCell = (likelihood: number, impact: number) => {
    return risks.filter(
      r => r.residual_likelihood === likelihood && r.residual_impact === impact
    );
  };

  const getCellColor = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 20) return 'bg-red-500 hover:bg-red-600';
    if (score >= 15) return 'bg-orange-500 hover:bg-orange-600';
    if (score >= 9) return 'bg-yellow-400 hover:bg-yellow-500';
    return 'bg-green-500 hover:bg-green-600';
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
          <Grid className="w-8 h-8 text-blue-600" />
          Risk Matrisi (5x5)
        </h1>
        <p className="text-slate-600 mt-2">Riskleri olasılık ve etki bazında görselleştirin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-24 p-2"></th>
                <th className="p-2 text-sm font-semibold text-slate-700">1 - Çok Düşük</th>
                <th className="p-2 text-sm font-semibold text-slate-700">2 - Düşük</th>
                <th className="p-2 text-sm font-semibold text-slate-700">3 - Orta</th>
                <th className="p-2 text-sm font-semibold text-slate-700">4 - Yüksek</th>
                <th className="p-2 text-sm font-semibold text-slate-700">5 - Çok Yüksek</th>
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map((likelihood) => (
                <tr key={likelihood}>
                  <td className="p-2 text-sm font-semibold text-slate-700 text-center">
                    {likelihood === 5 && 'Çok Yüksek'}
                    {likelihood === 4 && 'Yüksek'}
                    {likelihood === 3 && 'Orta'}
                    {likelihood === 2 && 'Düşük'}
                    {likelihood === 1 && 'Çok Düşük'}
                    <div className="text-xs text-slate-500">Olasılık</div>
                  </td>
                  {[1, 2, 3, 4, 5].map((impact) => {
                    const cellRisks = getRisksInCell(likelihood, impact);
                    const score = likelihood * impact;
                    return (
                      <td
                        key={impact}
                        className={`p-2 border border-slate-300 ${getCellColor(likelihood, impact)} text-white transition-colors min-h-[100px] align-top`}
                      >
                        <div className="text-xs font-bold mb-1">Skor: {score}</div>
                        <div className="space-y-1">
                          {cellRisks.map((risk) => (
                            <div
                              key={risk.id}
                              className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 text-xs hover:bg-white/30 cursor-pointer"
                              title={risk.name}
                            >
                              {risk.code}
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Düşük (1-8)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded"></div>
            <span>Orta (9-14)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>Yüksek (15-19)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Kritik (20-25)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
