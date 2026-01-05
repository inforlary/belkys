import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
  category: any;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  risk_level: string;
}

export default function RiskMatrix() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'inherent' | 'residual'>('residual');
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadRisks();
    }
  }, [profile]);

  const loadRisks = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select(`
          *,
          category:risk_categories(name, color)
        `)
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
    return risks.filter(risk => {
      const l = viewType === 'inherent' ? risk.inherent_likelihood : risk.residual_likelihood;
      const i = viewType === 'inherent' ? risk.inherent_impact : risk.residual_impact;
      return l === likelihood && i === impact;
    });
  };

  const getCellColor = (score: number) => {
    if (score >= 21) return 'bg-red-900';
    if (score >= 17) return 'bg-red-500';
    if (score >= 10) return 'bg-orange-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getCellTextColor = (score: number) => {
    if (score >= 5) return 'text-white';
    return 'text-gray-900';
  };

  const matrix = [];
  for (let impact = 5; impact >= 1; impact--) {
    const row = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const score = likelihood * impact;
      const cellRisks = getRisksInCell(likelihood, impact);
      row.push({
        likelihood,
        impact,
        score,
        risks: cellRisks,
        count: cellRisks.length
      });
    }
    matrix.push(row);
  }

  const filteredRisks = selectedCell
    ? getRisksInCell(selectedCell.likelihood, selectedCell.impact)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
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
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">5×5 Risk Matrisi</h1>
            <p className="text-gray-600">İnteraktif risk değerlendirme matrisi</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewType('inherent')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewType === 'inherent'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Doğal Risk
          </button>
          <button
            onClick={() => setViewType('residual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewType === 'residual'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Artık Risk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {viewType === 'inherent' ? 'Doğal Risk Matrisi' : 'Artık Risk Matrisi'}
              </h2>
              <p className="text-sm text-gray-600">
                Hücreye tıklayarak o seviyedeki riskleri görüntüleyebilirsiniz
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-16 top-1/2 transform -translate-y-1/2 -rotate-90">
                <span className="text-sm font-semibold text-gray-700">ETKİ →</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {matrix.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            onClick={() => setSelectedCell({ likelihood: cell.likelihood, impact: cell.impact })}
                            className={`
                              relative border border-gray-300 cursor-pointer
                              transition-all hover:opacity-80
                              ${getCellColor(cell.score)} ${getCellTextColor(cell.score)}
                              ${selectedCell?.likelihood === cell.likelihood && selectedCell?.impact === cell.impact
                                ? 'ring-4 ring-blue-500 ring-inset'
                                : ''}
                            `}
                            style={{ width: '20%', height: '100px' }}
                          >
                            <div className="absolute top-1 left-1 text-xs opacity-75">
                              {cell.score}
                            </div>
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <div className="text-2xl font-bold">{cell.count}</div>
                                <div className="text-xs mt-1">risk</div>
                              </div>
                            </div>
                            {cell.risks.length > 0 && (
                              <div className="absolute bottom-1 right-1">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-center mt-4">
                <span className="text-sm font-semibold text-gray-700">← OLASILIK</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Olasılık Seviyeleri</h3>
                <div className="space-y-1 text-gray-600">
                  <div>1 - Çok Düşük</div>
                  <div>2 - Düşük</div>
                  <div>3 - Orta</div>
                  <div>4 - Yüksek</div>
                  <div>5 - Çok Yüksek</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Etki Seviyeleri</h3>
                <div className="space-y-1 text-gray-600">
                  <div>1 - Çok Düşük</div>
                  <div>2 - Düşük</div>
                  <div>3 - Orta</div>
                  <div>4 - Yüksek</div>
                  <div>5 - Çok Yüksek</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Risk Seviye Renkleri</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded"></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Düşük</div>
                  <div className="text-xs text-gray-600">Skor: 1-4</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-500 rounded"></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Orta</div>
                  <div className="text-xs text-gray-600">Skor: 5-9</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded"></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Yüksek</div>
                  <div className="text-xs text-gray-600">Skor: 10-16</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500 rounded"></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Çok Yüksek</div>
                  <div className="text-xs text-gray-600">Skor: 17-20</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-900 rounded"></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Kritik</div>
                  <div className="text-xs text-gray-600">Skor: 21-25</div>
                </div>
              </div>
            </div>
          </div>

          {selectedCell && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Seçili Hücre ({selectedCell.likelihood}×{selectedCell.impact})
              </h3>

              {filteredRisks.length === 0 ? (
                <p className="text-sm text-gray-500">Bu hücrede risk bulunmuyor</p>
              ) : (
                <div className="space-y-3">
                  {filteredRisks.map(risk => (
                    <button
                      key={risk.id}
                      onClick={() => navigate(`risks/register/${risk.id}`)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {risk.category && (
                          <div
                            className="w-3 h-3 rounded mt-1 flex-shrink-0"
                            style={{ backgroundColor: risk.category.color }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {risk.code}
                          </div>
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {risk.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-900 mb-2">Toplam Risk İstatistikleri</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Toplam Risk:</span>
                <span className="font-semibold">{risks.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Kritik/Çok Yüksek:</span>
                <span className="font-semibold">
                  {risks.filter(r => {
                    const score = viewType === 'inherent' ? r.inherent_score : r.residual_score;
                    return score >= 17;
                  }).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Yüksek:</span>
                <span className="font-semibold">
                  {risks.filter(r => {
                    const score = viewType === 'inherent' ? r.inherent_score : r.residual_score;
                    return score >= 10 && score < 17;
                  }).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Orta ve Altı:</span>
                <span className="font-semibold">
                  {risks.filter(r => {
                    const score = viewType === 'inherent' ? r.inherent_score : r.residual_score;
                    return score < 10;
                  }).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
