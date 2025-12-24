import React from 'react';

interface Risk {
  id: string;
  risk_code: string;
  risk_title: string;
  inherent_likelihood: number;
  inherent_impact: number;
  residual_likelihood: number;
  residual_impact: number;
}

interface RiskHeatMapProps {
  risks: Risk[];
  type: 'inherent' | 'residual';
}

export function RiskHeatMap({ risks, type }: RiskHeatMapProps) {
  const matrix = Array(5).fill(null).map(() => Array(5).fill([]));

  risks.forEach(risk => {
    const likelihood = type === 'inherent' ? risk.inherent_likelihood : risk.residual_likelihood;
    const impact = type === 'inherent' ? risk.inherent_impact : risk.residual_impact;

    if (likelihood && impact) {
      const row = 5 - likelihood;
      const col = impact - 1;
      matrix[row][col] = [...matrix[row][col], risk];
    }
  });

  const getRiskColor = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 20) return 'bg-red-600';
    if (score >= 15) return 'bg-red-500';
    if (score >= 10) return 'bg-orange-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRiskLevel = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Yüksek';
    if (score >= 10) return 'Orta';
    if (score >= 5) return 'Düşük';
    return 'Çok Düşük';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {type === 'inherent' ? 'Doğal Risk' : 'Artık Risk'} Isı Haritası
      </h3>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            <div className="w-24 flex items-center justify-center">
              <div className="transform -rotate-90 whitespace-nowrap font-semibold text-sm text-gray-700">
                Olasılık
              </div>
            </div>

            <div className="flex-1">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-16 h-16 border border-gray-300 bg-gray-50 text-xs font-semibold"></th>
                    {[1, 2, 3, 4, 5].map(impact => (
                      <th key={impact} className="h-16 border border-gray-300 bg-gray-50 text-xs font-semibold">
                        {impact}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((likelihood, rowIndex) => (
                    <tr key={likelihood}>
                      <td className="w-16 h-24 border border-gray-300 bg-gray-50 text-center text-xs font-semibold">
                        {likelihood}
                      </td>
                      {[1, 2, 3, 4, 5].map((impact, colIndex) => {
                        const cellRisks = matrix[rowIndex][colIndex];
                        const bgColor = getRiskColor(likelihood, impact);
                        const riskLevel = getRiskLevel(likelihood, impact);

                        return (
                          <td
                            key={impact}
                            className={`h-24 border border-gray-300 ${bgColor} bg-opacity-20 hover:bg-opacity-30 transition-all relative group`}
                          >
                            <div className="p-2 h-full flex flex-col">
                              <div className="text-xs font-semibold text-gray-700 mb-1">
                                {riskLevel} ({likelihood}x{impact}={likelihood * impact})
                              </div>
                              {cellRisks.length > 0 && (
                                <div className="flex-1 overflow-y-auto">
                                  {cellRisks.map((risk: Risk) => (
                                    <div
                                      key={risk.id}
                                      className="text-xs bg-white bg-opacity-90 rounded px-1 py-0.5 mb-1 truncate"
                                      title={risk.risk_title}
                                    >
                                      {risk.risk_code}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs font-bold text-gray-600 mt-1">
                                {cellRisks.length} Risk
                              </div>
                            </div>

                            {cellRisks.length > 0 && (
                              <div className="absolute hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded p-2 -top-2 left-full ml-2 w-64 shadow-lg">
                                <div className="font-bold mb-1">Riskler:</div>
                                {cellRisks.map((risk: Risk) => (
                                  <div key={risk.id} className="mb-1">
                                    • {risk.risk_code}: {risk.risk_title}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-center mt-2 font-semibold text-sm text-gray-700">
                Etki
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-4 justify-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600 rounded"></div>
          <span className="text-xs text-gray-600">Kritik (20-25)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-xs text-gray-600">Yüksek (15-19)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span className="text-xs text-gray-600">Orta (10-14)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-xs text-gray-600">Düşük (5-9)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-xs text-gray-600">Çok Düşük (1-4)</span>
        </div>
      </div>
    </div>
  );
}
