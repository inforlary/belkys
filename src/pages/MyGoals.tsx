import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Target, TrendingUp, Calendar, BarChart3, Award, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { calculateGoalProgress, calculateIndicatorProgress, getProgressColor } from '../utils/progressCalculations';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Indicator {
  id: string;
  code: string;
  name: string;
  unit: string;
  baseline_value: number | null;
  target_value: number | null;
  target_year: number | null;
  current_value: number | null;
  measurement_unit: string;
  measurement_frequency: string;
  collection_frequency: string;
  yearly_target?: number | null;
  goal_impact_percentage?: number | null;
  calculation_method?: string;
  goal: {
    id?: string;
    code: string;
    title: string;
    objective: {
      code: string;
      title: string;
    };
  };
}

interface DataEntry {
  indicator_id?: string;
  period_quarter: number | null;
  value: number;
  status: string;
}

export default function MyGoals() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [dataEntries, setDataEntries] = useState<Record<string, DataEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    if (!profile?.department_id && profile.role !== 'admin') {
      setLoading(false);
      return;
    }

    try {
      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          *,
          goals!inner(
            id,
            code,
            title,
            department_id,
            objectives!inner(
              code,
              title
            )
          )
        `)
        .eq('organization_id', profile.organization_id);

      if (profile.department_id && profile.role !== 'admin') {
        indicatorsQuery = indicatorsQuery.eq('goals.department_id', profile.department_id);
      }

      const [indicatorsRes, entriesRes, targetsRes] = await Promise.all([
        indicatorsQuery.order('code', { ascending: true }),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, period_quarter, value, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', selectedYear)
          .in('status', ['approved', 'submitted']),
        supabase
          .from('indicator_targets')
          .select('indicator_id, year, target_value')
          .eq('year', selectedYear)
      ]);

      if (indicatorsRes.error) throw indicatorsRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (targetsRes.error) throw targetsRes.error;

      const targetsByIndicator: Record<string, number> = {};
      targetsRes.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      const indicatorsData = indicatorsRes.data?.map(ind => ({
        ...ind,
        yearly_target: targetsByIndicator[ind.id] || null,
        goal: {
          id: ind.goals.id,
          code: ind.goals.code,
          title: ind.goals.title,
          objective: {
            code: ind.goals.objectives.code,
            title: ind.goals.objectives.title
          }
        }
      })) || [];

      setIndicators(indicatorsData);

      const entriesByIndicator: Record<string, DataEntry[]> = {};
      entriesRes.data?.forEach(entry => {
        if (!entriesByIndicator[entry.indicator_id]) {
          entriesByIndicator[entry.indicator_id] = [];
        }
        entriesByIndicator[entry.indicator_id].push(entry);
      });
      setDataEntries(entriesByIndicator);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentValue = (indicator: Indicator) => {
    const entries = dataEntries[indicator.id] || [];
    const validEntries = entries.filter(e => e.status === 'approved' || e.status === 'submitted');

    if (validEntries.length === 0) return 0;

    // Sum all quarterly/period entries
    const totalEntered = validEntries.reduce((sum, entry) => sum + entry.value, 0);
    return totalEntered;
  };

  const calculateProgress = (indicator: Indicator) => {
    const allDataEntries = Object.entries(dataEntries).flatMap(([indicatorId, entries]) =>
      entries.map(entry => ({ ...entry, indicator_id: indicatorId }))
    );

    return calculateIndicatorProgress({
      id: indicator.id,
      goal_id: indicator.goal.id || '',
      goal_impact_percentage: indicator.goal_impact_percentage,
      yearly_target: indicator.yearly_target,
      target_value: indicator.target_value,
      baseline_value: indicator.baseline_value,
      calculation_method: indicator.calculation_method
    }, allDataEntries);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 115) return 'bg-purple-500';
    if (progress >= 85) return 'bg-green-500';
    if (progress >= 70) return 'bg-green-400';
    if (progress >= 55) return 'bg-yellow-500';
    if (progress >= 45) return 'bg-red-500';
    return 'bg-amber-700';
  };

  const getExpectedEntries = (frequency: string) => {
    if (frequency === 'quarterly' || frequency === '3-month') return 4;
    if (frequency === 'semi-annual' || frequency === 'semi_annual' || frequency === '6-month') return 2;
    if (frequency === 'monthly') return 12;
    if (frequency === 'annual' || frequency === 'yearly') return 1;
    return 4;
  };

  const getCompletedEntries = (indicator: Indicator) => {
    const entries = dataEntries[indicator.id] || [];
    return entries.filter(e => e.status === 'approved' || e.status === 'submitted').length;
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      'quarterly': '3 Aylık',
      '3-month': '3 Aylık',
      'semi-annual': '6 Aylık',
      'semi_annual': '6 Aylık',
      '6-month': '6 Aylık',
      'monthly': 'Aylık',
      'annual': 'Yıllık',
      'yearly': 'Yıllık'
    };
    return labels[frequency] || frequency;
  };

  const getQuarterLabel = (quarter: number) => {
    const labels: Record<number, string> = {
      1: 'Ocak - Mart',
      2: 'Nisan - Haziran',
      3: 'Temmuz - Eylül',
      4: 'Ekim - Aralık'
    };
    return labels[quarter] || `Ç${quarter}`;
  };

  const exportToExcel = () => {
    const exportData = indicators.map(indicator => {
      const progress = calculateProgress(indicator);
      const expectedEntries = getExpectedEntries(indicator.measurement_frequency);
      const completedEntries = getCompletedEntries(indicator);

      return {
        'Amaç Kodu': indicator.goal.objective.code,
        'Amaç': indicator.goal.objective.title,
        'Hedef Kodu': indicator.goal.code,
        'Hedef': indicator.goal.title,
        'Gösterge Kodu': indicator.code,
        'Gösterge Adı': indicator.name,
        'Ölçüm Sıklığı': getFrequencyLabel(indicator.measurement_frequency),
        'Başlangıç Değeri': indicator.baseline_value || 0,
        'Hedef Değer': indicator.yearly_target || 'Belirtilmemiş',
        'Güncel Değer': getCurrentValue(indicator),
        'Birim': indicator.unit,
        'Veri Girişi': `${completedEntries}/${expectedEntries}`,
        'Gerçekleşme (%)': indicator.yearly_target ? progress : 'Hedef Yok'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hedeflerim');

    const colWidths = [
      { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 30 },
      { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `Hedeflerim_${selectedYear}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Hedeflerim ve Göstergelerim', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Yıl: ${selectedYear}`, 14, 22);

    const tableData = indicators.map(indicator => {
      const progress = calculateProgress(indicator);
      const expectedEntries = getExpectedEntries(indicator.measurement_frequency);
      const completedEntries = getCompletedEntries(indicator);

      return [
        indicator.goal.objective.code,
        indicator.goal.code,
        indicator.code,
        indicator.name,
        getFrequencyLabel(indicator.measurement_frequency),
        indicator.baseline_value || 0,
        indicator.yearly_target || '-',
        getCurrentValue(indicator),
        indicator.unit,
        `${completedEntries}/${expectedEntries}`,
        indicator.yearly_target ? `${progress}%` : '-'
      ];
    });

    autoTable(doc, {
      head: [[
        'Amaç',
        'Hedef',
        'Gösterge',
        'Gösterge Adı',
        'Sıklık',
        'Başlangıç',
        'Hedef',
        'Güncel',
        'Birim',
        'Veri Girişi',
        'Gerçekleşme'
      ]],
      body: tableData,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15 },
        3: { cellWidth: 60 },
        4: { cellWidth: 15 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
        7: { cellWidth: 15 },
        8: { cellWidth: 12 },
        9: { cellWidth: 15 },
        10: { cellWidth: 15 }
      }
    });

    doc.save(`Hedeflerim_${selectedYear}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!profile?.department_id && profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardBody>
            <div className="text-center">
              <Target className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-slate-600">
                Hedef ve göstergelerinizi görebilmek için bir müdürlüğe atanmış olmalısınız.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hedeflerim ve Göstergelerim</h1>
          <p className="text-slate-600 mt-1">
            Müdürlüğünüze atanan hedefler ve performans göstergeleri
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          {indicators.length > 0 && (
            <>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel İndir
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                PDF İndir
              </button>
            </>
          )}
        </div>
      </div>

      {indicators.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Henüz müdürlüğünüze atanmış hedef veya gösterge bulunmuyor</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(new Set(indicators.map(i => i.goal.code))).map(goalCode => {
            const goalIndicators = indicators.filter(i => i.goal.code === goalCode);
            const firstIndicator = goalIndicators[0];
            const allDataEntries = Object.entries(dataEntries).flatMap(([indicatorId, entries]) =>
              entries.map(entry => ({ ...entry, indicator_id: indicatorId }))
            );
            const goalProgress = calculateGoalProgress(
              goalIndicators[0].goal.id || '',
              goalIndicators.map(ind => ({
                id: ind.id,
                goal_id: ind.goal.id || '',
                goal_impact_percentage: ind.goal_impact_percentage,
                yearly_target: ind.yearly_target,
                target_value: ind.target_value,
                baseline_value: ind.baseline_value,
                calculation_method: ind.calculation_method
              })),
              allDataEntries
            );

            return (
              <div key={goalCode} className="space-y-4">
                <Card className="bg-blue-50 border-2 border-blue-200">
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Award className="w-6 h-6 text-blue-600" />
                        <div>
                          <div className="text-sm font-medium text-blue-600">{firstIndicator.goal.code}</div>
                          <h2 className="text-lg font-bold text-slate-900">{firstIndicator.goal.title}</h2>
                          <div className="text-xs text-slate-600 mt-1">
                            {firstIndicator.goal.objective.code} - {firstIndicator.goal.objective.title}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-600 mb-1">Hedef İlerlemesi</div>
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-200 rounded-full h-3 w-32">
                            <div
                              className={`h-3 rounded-full ${getProgressColor(goalProgress)}`}
                              style={{ width: `${Math.min(100, goalProgress)}%` }}
                            />
                          </div>
                          <span className="text-2xl font-bold text-slate-900">%{goalProgress}</span>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {goalIndicators.map((indicator) => {
                  const progress = calculateProgress(indicator);
                  const expectedEntries = getExpectedEntries(indicator.measurement_frequency);
                  const completedEntries = getCompletedEntries(indicator);

                  return (
                    <Card key={indicator.id} className="ml-8">
                <CardBody>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {indicator.code}
                          </span>
                          <span className="text-xs text-slate-500">
                            {getFrequencyLabel(indicator.measurement_frequency)}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">{indicator.name}</h3>
                        <div className="text-sm text-slate-600 mt-1">
                          <span className="font-medium">{indicator.goal.code}</span> - {indicator.goal.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          <span className="font-medium">{indicator.goal.objective.code}</span> - {indicator.goal.objective.title}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-slate-600 mb-1">
                          <BarChart3 className="w-4 h-4" />
                          <span className="text-xs font-medium">Başlangıç</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900">
                          {indicator.baseline_value || 0} {indicator.unit}
                        </div>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-xs font-medium">Güncel Değer</span>
                        </div>
                        <div className="text-xl font-bold text-green-900">
                          {getCurrentValue(indicator)} {indicator.unit}
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <Target className="w-4 h-4" />
                          <span className="text-xs font-medium">Hedef ({selectedYear})</span>
                        </div>
                        <div className="text-xl font-bold text-blue-900">
                          {indicator.yearly_target ? `${indicator.yearly_target} ${indicator.unit}` : 'Belirtilmemiş'}
                        </div>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs font-medium">Veri Girişi</span>
                        </div>
                        <div className="text-xl font-bold text-purple-900">
                          {completedEntries} / {expectedEntries}
                        </div>
                      </div>
                    </div>

                    {indicator.yearly_target ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Gerçekleşme Oranı</span>
                          <span className="font-medium text-slate-900">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${getProgressColor(progress)}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                        <p className="text-sm text-yellow-700">Bu gösterge için hedef değer belirlenmemiş. İlerleme hesaplanamıyor.</p>
                      </div>
                    )}

                    {dataEntries[indicator.id] && dataEntries[indicator.id].length > 0 && (
                      <div className="border-t border-slate-200 pt-3">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">{selectedYear} Yılı Veri Girişleri</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {dataEntries[indicator.id]
                            .sort((a, b) => (a.period_quarter || 0) - (b.period_quarter || 0))
                            .map((entry, idx) => (
                              <div key={idx} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200">
                                <div className="text-xs font-medium text-slate-600 mb-1">
                                  Ç{entry.period_quarter}
                                </div>
                                <div className="text-xs text-slate-500 mb-2">
                                  {getQuarterLabel(entry.period_quarter || 0)}
                                </div>
                                <div className="text-xl font-bold text-slate-900 mb-2">
                                  {entry.value} {indicator.unit || indicator.measurement_unit}
                                </div>
                                <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                  entry.status === 'approved'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {entry.status === 'approved' ? '✓ Onaylı' : '◷ Onay Bekliyor'}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
