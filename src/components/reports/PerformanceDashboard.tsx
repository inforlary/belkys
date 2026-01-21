import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, TrendingUp, TrendingDown, Minus, FileText, ArrowUpDown, X } from 'lucide-react';
import { exportToExcel } from '../../utils/exportHelpers';
import { generatePerformanceDashboardPDF } from '../../utils/reportPDFGenerators';
import Modal from '../ui/Modal';

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  avg_progress: number;
  on_track: number;
  at_risk: number;
  behind: number;
}

interface IndicatorDetail {
  id: string;
  name: string;
  code: string;
  current_value: number;
  target_value: number;
  progress: number;
  status: 'on_track' | 'at_risk' | 'behind';
}

interface PerformanceDashboardProps {
  selectedYear?: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'progress-desc' | 'progress-asc' | 'count-desc' | 'count-asc';

export default function PerformanceDashboard({ selectedYear }: PerformanceDashboardProps) {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DepartmentPerformance[]>([]);
  const [sortedDepartments, setSortedDepartments] = useState<DepartmentPerformance[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('progress-desc');
  const currentYear = selectedYear || new Date().getFullYear();
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'on_track' | 'at_risk' | 'behind' | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentPerformance | null>(null);
  const [indicatorDetails, setIndicatorDetails] = useState<IndicatorDetail[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  useEffect(() => {
    sortDepartments();
  }, [departments, sortBy]);

  const sortDepartments = () => {
    const sorted = [...departments].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.department_name.localeCompare(b.department_name, 'tr');
        case 'name-desc':
          return b.department_name.localeCompare(a.department_name, 'tr');
        case 'progress-desc':
          return b.avg_progress - a.avg_progress;
        case 'progress-asc':
          return a.avg_progress - b.avg_progress;
        case 'count-desc':
          return b.total_indicators - a.total_indicators;
        case 'count-asc':
          return a.total_indicators - b.total_indicators;
        default:
          return 0;
      }
    });
    setSortedDepartments(sorted);
  };

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {

      let deptsQuery = supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their own department
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        deptsQuery = deptsQuery.eq('id', profile.department_id);
      }

      const { data: depts } = await deptsQuery.order('name');

      if (depts) {
        const performanceData = await Promise.all(
          depts.map(async (dept) => {
            const { data: goals } = await supabase
              .from('goals')
              .select('id')
              .eq('organization_id', profile.organization_id)
              .eq('department_id', dept.id);

            if (!goals || goals.length === 0) {
              return {
                department_id: dept.id,
                department_name: dept.name,
                total_indicators: 0,
                avg_progress: 0,
                on_track: 0,
                at_risk: 0,
                behind: 0,
              };
            }

            const goalIds = goals.map(g => g.id);

            const { data: indicators } = await supabase
              .from('indicators')
              .select('id')
              .eq('organization_id', profile.organization_id)
              .in('goal_id', goalIds);

            if (!indicators || indicators.length === 0) {
              return {
                department_id: dept.id,
                department_name: dept.name,
                total_indicators: 0,
                avg_progress: 0,
                on_track: 0,
                at_risk: 0,
                behind: 0,
              };
            }

            const indicatorIds = indicators.map(i => i.id);

            const [entriesResult, targetsResult] = await Promise.all([
              supabase
                .from('indicator_data_entries')
                .select('indicator_id, value')
                .eq('organization_id', profile.organization_id)
                .eq('period_year', currentYear)
                .in('status', ['approved', 'submitted'])
                .in('indicator_id', indicatorIds),
              supabase
                .from('indicator_targets')
                .select('indicator_id, target_value')
                .eq('year', currentYear)
                .in('indicator_id', indicatorIds),
            ]);

            const entriesByIndicator: Record<string, number> = {};
            entriesResult.data?.forEach(entry => {
              if (!entriesByIndicator[entry.indicator_id]) {
                entriesByIndicator[entry.indicator_id] = 0;
              }
              entriesByIndicator[entry.indicator_id] += entry.value;
            });

            const targetsByIndicator: Record<string, number> = {};
            targetsResult.data?.forEach(target => {
              targetsByIndicator[target.indicator_id] = target.target_value;
            });

            let totalProgress = 0;
            let onTrack = 0;
            let atRisk = 0;
            let behind = 0;
            let validCount = 0;

            indicatorIds.forEach(id => {
              const target = targetsByIndicator[id];
              if (target && target > 0) {
                const current = entriesByIndicator[id] || 0;
                const progress = (current / target) * 100;
                totalProgress += progress;
                validCount++;

                if (progress >= 70) onTrack++;
                else if (progress >= 50) atRisk++;
                else behind++;
              }
            });

            return {
              department_id: dept.id,
              department_name: dept.name,
              total_indicators: validCount,
              avg_progress: validCount > 0 ? totalProgress / validCount : 0,
              on_track: onTrack,
              at_risk: atRisk,
              behind: behind,
            };
          })
        );

        setDepartments(performanceData);

        const totalValidIndicators = performanceData.reduce((sum, d) => sum + d.total_indicators, 0);
        const weightedProgress = performanceData.reduce(
          (sum, d) => sum + (d.avg_progress * d.total_indicators),
          0
        );
        setOverallProgress(totalValidIndicators > 0 ? weightedProgress / totalValidIndicators : 0);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = sortedDepartments.map((dept, index) => ({
      'Sıra': index + 1,
      'Birim': dept.department_name,
      'Gösterge Sayısı': dept.total_indicators,
      'Ortalama İlerleme (%)': Math.round(dept.avg_progress),
      'Hedefte': dept.on_track,
      'Risk Altında': dept.at_risk,
      'Geride': dept.behind,
    }));

    exportToExcel(exportData, 'Performans_Gosterge_Paneli');
  };

  const handlePDFExport = () => {
    generatePerformanceDashboardPDF(sortedDepartments, overallProgress);
  };

  const loadIndicatorDetails = async (dept: DepartmentPerformance, status: 'on_track' | 'at_risk' | 'behind') => {
    if (!profile?.organization_id) return;

    setSelectedDepartment(dept);
    setSelectedStatus(status);
    setShowIndicatorModal(true);
    setLoadingIndicators(true);

    try {
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('department_id', dept.department_id);

      if (!goals || goals.length === 0) {
        setIndicatorDetails([]);
        return;
      }

      const goalIds = goals.map(g => g.id);

      const { data: indicators } = await supabase
        .from('indicators')
        .select('id, name, code')
        .eq('organization_id', profile.organization_id)
        .in('goal_id', goalIds);

      if (!indicators || indicators.length === 0) {
        setIndicatorDetails([]);
        return;
      }

      const indicatorIds = indicators.map(i => i.id);

      const [entriesResult, targetsResult] = await Promise.all([
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .in('status', ['approved', 'submitted'])
          .in('indicator_id', indicatorIds),
        supabase
          .from('indicator_targets')
          .select('indicator_id, target_value')
          .eq('year', currentYear)
          .in('indicator_id', indicatorIds),
      ]);

      const entriesByIndicator: Record<string, number> = {};
      entriesResult.data?.forEach(entry => {
        if (!entriesByIndicator[entry.indicator_id]) {
          entriesByIndicator[entry.indicator_id] = 0;
        }
        entriesByIndicator[entry.indicator_id] += entry.value;
      });

      const targetsByIndicator: Record<string, number> = {};
      targetsResult.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      const details: IndicatorDetail[] = [];

      indicators.forEach(indicator => {
        const target = targetsByIndicator[indicator.id];
        if (target && target > 0) {
          const current = entriesByIndicator[indicator.id] || 0;
          const progress = (current / target) * 100;

          let indicatorStatus: 'on_track' | 'at_risk' | 'behind';
          if (progress >= 70) indicatorStatus = 'on_track';
          else if (progress >= 50) indicatorStatus = 'at_risk';
          else indicatorStatus = 'behind';

          if (indicatorStatus === status) {
            details.push({
              id: indicator.id,
              name: indicator.name,
              code: indicator.code || '',
              current_value: current,
              target_value: target,
              progress: progress,
              status: indicatorStatus,
            });
          }
        }
      });

      details.sort((a, b) => a.code.localeCompare(b.code));
      setIndicatorDetails(details);
    } catch (error) {
      console.error('Gösterge detayları yükleme hatası:', error);
    } finally {
      setLoadingIndicators(false);
    }
  };

  const getStatusLabel = (status: 'on_track' | 'at_risk' | 'behind') => {
    switch (status) {
      case 'on_track': return 'Hedefte';
      case 'at_risk': return 'Risk Altında';
      case 'behind': return 'Geride';
    }
  };

  const getStatusColor = (status: 'on_track' | 'at_risk' | 'behind') => {
    switch (status) {
      case 'on_track': return 'text-green-600 bg-green-50';
      case 'at_risk': return 'text-yellow-600 bg-yellow-50';
      case 'behind': return 'text-red-600 bg-red-50';
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Performans Gösterge Paneli</h2>
          <p className="text-sm text-slate-600 mt-1">
            Birimler bazında performans karşılaştırması
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePDFExport}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF'e Aktar
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-4">
        <ArrowUpDown className="w-5 h-5 text-slate-500" />
        <label className="text-sm font-medium text-slate-700">Sıralama:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="progress-desc">İlerleme (Yüksekten Düşüğe)</option>
          <option value="progress-asc">İlerleme (Düşükten Yükseğe)</option>
          <option value="count-desc">Gösterge Sayısı (Yüksekten Düşüğe)</option>
          <option value="count-asc">Gösterge Sayısı (Düşükten Yükseğe)</option>
          <option value="name-asc">Birim Adı (A-Z)</option>
          <option value="name-desc">Birim Adı (Z-A)</option>
        </select>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Kurum Genel İlerleme</p>
            <p className="text-4xl font-bold mt-2">{Math.round(overallProgress)}%</p>
          </div>
          {overallProgress >= 70 ? (
            <TrendingUp className="w-16 h-16 text-blue-200" />
          ) : overallProgress >= 50 ? (
            <Minus className="w-16 h-16 text-blue-200" />
          ) : (
            <TrendingDown className="w-16 h-16 text-blue-200" />
          )}
        </div>
      </div>

      {sortedDepartments.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz veri bulunmuyor</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedDepartments.map((dept, index) => {
            const rank = index + 1;
            const isTopThree = sortBy === 'progress-desc' && rank <= 3;
            const rankColors = {
              1: 'bg-yellow-100 text-yellow-800 border-yellow-300',
              2: 'bg-gray-100 text-gray-800 border-gray-300',
              3: 'bg-orange-100 text-orange-800 border-orange-300'
            };

            return (
              <div
                key={dept.department_id}
                className={`bg-white border rounded-lg p-6 ${
                  isTopThree ? 'border-2 ' + (rankColors[rank as 1 | 2 | 3] || '') : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      isTopThree ? rankColors[rank as 1 | 2 | 3] : 'bg-slate-100 text-slate-600'
                    }`}>
                      {rank}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{dept.department_name}</h3>
                      <p className="text-sm text-slate-600">{dept.total_indicators} gösterge</p>
                    </div>
                  </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(dept.avg_progress)}%
                  </div>
                  <div className="text-xs text-slate-500">Ortalama İlerleme</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      dept.avg_progress >= 70
                        ? 'bg-green-500'
                        : dept.avg_progress >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(dept.avg_progress, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => dept.on_track > 0 && loadIndicatorDetails(dept, 'on_track')}
                  disabled={dept.on_track === 0}
                  className={`bg-green-50 rounded-lg p-3 text-center transition-all ${
                    dept.on_track > 0 ? 'hover:bg-green-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-green-600">{dept.on_track}</div>
                  <div className="text-xs text-slate-600">Hedefte</div>
                </button>
                <button
                  onClick={() => dept.at_risk > 0 && loadIndicatorDetails(dept, 'at_risk')}
                  disabled={dept.at_risk === 0}
                  className={`bg-yellow-50 rounded-lg p-3 text-center transition-all ${
                    dept.at_risk > 0 ? 'hover:bg-yellow-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-yellow-600">{dept.at_risk}</div>
                  <div className="text-xs text-slate-600">Risk Altında</div>
                </button>
                <button
                  onClick={() => dept.behind > 0 && loadIndicatorDetails(dept, 'behind')}
                  disabled={dept.behind === 0}
                  className={`bg-red-50 rounded-lg p-3 text-center transition-all ${
                    dept.behind > 0 ? 'hover:bg-red-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl font-bold text-red-600">{dept.behind}</div>
                  <div className="text-xs text-slate-600">Geride</div>
                </button>
              </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        title={`${selectedDepartment?.department_name} - ${selectedStatus ? getStatusLabel(selectedStatus) : ''} Göstergeler`}
        size="large"
      >
        <div className="space-y-4">
          {loadingIndicators ? (
            <div className="text-center py-8 text-slate-500">Göstergeler yükleniyor...</div>
          ) : indicatorDetails.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Bu kategoride gösterge bulunmuyor</div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Toplam <span className="font-bold text-slate-900">{indicatorDetails.length}</span> gösterge
                  </div>
                  {selectedStatus && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedStatus)}`}>
                      {getStatusLabel(selectedStatus)}
                    </div>
                  )}
                </div>
              </div>

              {indicatorDetails.map((indicator) => (
                <div
                  key={indicator.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {indicator.code}
                        </span>
                        {selectedStatus && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(selectedStatus)}`}>
                            {getStatusLabel(selectedStatus)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-slate-900 mb-3">{indicator.name}</h4>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Gerçekleşen</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {indicator.current_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Hedef</div>
                          <div className="text-lg font-semibold text-slate-700">
                            {indicator.target_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">İlerleme</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {Math.round(indicator.progress)}%
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              indicator.status === 'on_track'
                                ? 'bg-green-500'
                                : indicator.status === 'at_risk'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(indicator.progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => setShowIndicatorModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
