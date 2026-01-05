import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, FileText, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface YearEndReportsProps {
  fiscalYear: number;
}

interface EvaluationSummary {
  department_id: string;
  department_name: string;
  evaluation_id: string;
  status: string;
  submitted_at: string | null;
  director_approved_at: string | null;
  admin_approved_at: string | null;
  general_performance_summary: string | null;
  achievements: string | null;
  challenges: string | null;
  recommendations: string | null;
  director_comments: string | null;
  admin_comments: string | null;
  total_indicators: number;
  completed_indicator_evaluations: number;
  completion_rate: number;
}

interface IndicatorEvaluation {
  indicator_id: string;
  indicator_code: string;
  indicator_name: string;
  goal_name: string;
  department_name: string;
  evaluation_id: string | null;
  relevance_environment_changes: string | null;
  relevance_needs_change: string | null;
  relevance_target_change_needed: string | null;
  effectiveness_target_achieved: string | null;
  effectiveness_needs_met: string | null;
  effectiveness_update_needed: string | null;
  effectiveness_contribution: string | null;
  efficiency_unexpected_costs: string | null;
  efficiency_cost_table_update: string | null;
  efficiency_target_change_due_cost: string | null;
  sustainability_risks: string | null;
  sustainability_measures: string | null;
  sustainability_risk_changes: string | null;
  sustainability_risk_impact: string | null;
  sustainability_plan_update_needed: string | null;
  needs_update: boolean;
}

interface CriteriaAnalysis {
  criteria_category: string;
  total_responses: number;
  indicators_with_concerns: number;
  indicators_needing_update: number;
  concern_percentage: number;
  common_themes: string[];
}

interface DepartmentComparison {
  department_name: string;
  total_indicators: number;
  indicators_needing_relevance_update: number;
  indicators_not_meeting_effectiveness: number;
  indicators_with_cost_issues: number;
  indicators_with_sustainability_risks: number;
  overall_risk_score: number;
  status: string;
  completion_rate: number;
}

export default function YearEndReports({ fiscalYear }: YearEndReportsProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'indicators' | 'criteria' | 'comparison'>('summary');

  const [summaryData, setSummaryData] = useState<EvaluationSummary[]>([]);
  const [indicatorData, setIndicatorData] = useState<IndicatorEvaluation[]>([]);
  const [criteriaData, setCriteriaData] = useState<CriteriaAnalysis[]>([]);
  const [comparisonData, setComparisonData] = useState<DepartmentComparison[]>([]);

  useEffect(() => {
    loadReportData();
  }, [fiscalYear, profile?.organization_id]);

  const loadReportData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      await Promise.all([
        loadSummaryReport(),
        loadIndicatorReport(),
        loadCriteriaReport(),
        loadComparisonReport()
      ]);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaryReport = async () => {
    const { data, error } = await supabase.rpc('get_year_end_evaluation_summary', {
      p_organization_id: profile!.organization_id,
      p_fiscal_year: fiscalYear
    });

    if (error) {
      console.error('Error loading summary report:', error);
      return;
    }

    setSummaryData(data || []);
  };

  const loadIndicatorReport = async () => {
    const { data, error } = await supabase.rpc('get_indicator_evaluations_report', {
      p_organization_id: profile!.organization_id,
      p_fiscal_year: fiscalYear,
      p_department_id: null
    });

    if (error) {
      console.error('Error loading indicator report:', error);
      return;
    }

    setIndicatorData(data || []);
  };

  const loadCriteriaReport = async () => {
    const { data, error } = await supabase.rpc('get_criteria_analysis_report', {
      p_organization_id: profile!.organization_id,
      p_fiscal_year: fiscalYear
    });

    if (error) {
      console.error('Error loading criteria report:', error);
      return;
    }

    setCriteriaData(data || []);
  };

  const loadComparisonReport = async () => {
    const { data, error } = await supabase.rpc('get_department_evaluation_comparison', {
      p_organization_id: profile!.organization_id,
      p_fiscal_year: fiscalYear
    });

    if (error) {
      console.error('Error loading comparison report:', error);
      return;
    }

    setComparisonData(data || []);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(
      summaryData.map(item => ({
        'Müdürlük': item.department_name,
        'Durum': item.status,
        'Toplam Gösterge': item.total_indicators,
        'Tamamlanan': item.completed_indicator_evaluations,
        'Tamamlanma %': item.completion_rate,
        'Genel Özet': item.general_performance_summary || '',
        'Başarılar': item.achievements || '',
        'Zorluklar': item.challenges || '',
        'Öneriler': item.recommendations || ''
      }))
    );
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Özet');

    const indicatorSheet = XLSX.utils.json_to_sheet(
      indicatorData.map(item => ({
        'Müdürlük': item.department_name,
        'Gösterge Kodu': item.indicator_code,
        'Gösterge Adı': item.indicator_name,
        'Hedef': item.goal_name,
        'Güncelleme Gerekiyor': item.needs_update ? 'Evet' : 'Hayır'
      }))
    );
    XLSX.utils.book_append_sheet(wb, indicatorSheet, 'Göstergeler');

    const criteriaSheet = XLSX.utils.json_to_sheet(
      criteriaData.map(item => ({
        'Kriter': item.criteria_category,
        'Toplam Yanıt': item.total_responses,
        'Endişe Olan': item.indicators_with_concerns,
        'Güncelleme Gerekli': item.indicators_needing_update,
        'Endişe %': item.concern_percentage
      }))
    );
    XLSX.utils.book_append_sheet(wb, criteriaSheet, 'Kriter Analizi');

    const comparisonSheet = XLSX.utils.json_to_sheet(
      comparisonData.map(item => ({
        'Müdürlük': item.department_name,
        'Toplam Gösterge': item.total_indicators,
        'İlgililik Güncelleme': item.indicators_needing_relevance_update,
        'Etkililik Sorunu': item.indicators_not_meeting_effectiveness,
        'Maliyet Sorunu': item.indicators_with_cost_issues,
        'Sürdürülebilirlik Riski': item.indicators_with_sustainability_risks,
        'Risk Skoru': item.overall_risk_score,
        'Tamamlanma %': item.completion_rate
      }))
    );
    XLSX.utils.book_append_sheet(wb, comparisonSheet, 'Karşılaştırma');

    XLSX.writeFile(wb, `Yil_Sonu_Degerlendirme_${fiscalYear}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`${fiscalYear} Yılı Yıl Sonu Değerlendirme Raporu`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    let yPos = 40;

    doc.setFontSize(14);
    doc.text('Müdürlük Özeti', 14, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Müdürlük', 'Durum', 'Gösterge', 'Tamamlanma %']],
      body: summaryData.map(item => [
        item.department_name,
        item.status,
        `${item.completed_indicator_evaluations}/${item.total_indicators}`,
        `${item.completion_rate}%`
      ]),
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Kriter Analizi', 14, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Kriter', 'Toplam', 'Endişe', 'Güncelleme', 'Endişe %']],
      body: criteriaData.map(item => [
        item.criteria_category,
        item.total_responses.toString(),
        item.indicators_with_concerns.toString(),
        item.indicators_needing_update.toString(),
        `${item.concern_percentage}%`
      ]),
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    doc.save(`Yil_Sonu_Degerlendirme_${fiscalYear}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Raporlar yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Değerlendirme Raporları</h2>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Yönetici Özeti
          </button>
          <button
            onClick={() => setActiveTab('indicators')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'indicators'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Gösterge Detayları
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'criteria'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Kriter Analizi
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comparison'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Müdürlük Karşılaştırma
          </button>
        </nav>
      </div>

      {activeTab === 'summary' && <SummaryReport data={summaryData} />}
      {activeTab === 'indicators' && <IndicatorReport data={indicatorData} />}
      {activeTab === 'criteria' && <CriteriaReport data={criteriaData} />}
      {activeTab === 'comparison' && <ComparisonReport data={comparisonData} />}
    </div>
  );
}

function SummaryReport({ data }: { data: EvaluationSummary[] }) {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-800' },
      submitted: { label: 'Onay Bekliyor', className: 'bg-yellow-100 text-yellow-800' },
      director_approved: { label: 'Müdür Onayladı', className: 'bg-blue-100 text-blue-800' },
      admin_approved: { label: 'Yönetici Onayladı', className: 'bg-green-100 text-green-800' },
      completed: { label: 'Tamamlandı', className: 'bg-green-600 text-white' }
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {data.map(item => (
        <Card key={item.department_id} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{item.department_name}</h3>
            {getStatusBadge(item.status)}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{item.total_indicators}</div>
              <div className="text-sm text-gray-600">Toplam Gösterge</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{item.completed_indicator_evaluations}</div>
              <div className="text-sm text-gray-600">Değerlendirilen</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">{item.completion_rate}%</div>
              <div className="text-sm text-gray-600">Tamamlanma</div>
            </div>
          </div>

          {item.general_performance_summary && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Genel Performans:</div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{item.general_performance_summary}</div>
            </div>
          )}

          {item.achievements && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Başarılar:</div>
              <div className="text-sm text-gray-600 bg-green-50 p-3 rounded">{item.achievements}</div>
            </div>
          )}

          {item.challenges && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Zorluklar:</div>
              <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded">{item.challenges}</div>
            </div>
          )}

          {item.recommendations && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Öneriler:</div>
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">{item.recommendations}</div>
            </div>
          )}
        </Card>
      ))}

      {data.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Henüz değerlendirme verisi bulunmamaktadır.</p>
        </Card>
      )}
    </div>
  );
}

function IndicatorReport({ data }: { data: IndicatorEvaluation[] }) {
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterNeedsUpdate, setFilterNeedsUpdate] = useState<boolean>(false);

  const departments = Array.from(new Set(data.map(d => d.department_name))).sort();

  const filteredData = data.filter(item => {
    if (filterDepartment !== 'all' && item.department_name !== filterDepartment) return false;
    if (filterNeedsUpdate && !item.needs_update) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="all">Tüm Müdürlükler</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filterNeedsUpdate}
            onChange={(e) => setFilterNeedsUpdate(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Sadece Güncelleme Gerekenleri Göster</span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müdürlük</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gösterge</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hedef</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Güncelleme</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{item.department_name}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{item.indicator_code}</div>
                  <div className="text-sm text-gray-500">{item.indicator_name}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.goal_name}</td>
                <td className="px-4 py-3 text-center">
                  {item.needs_update ? (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                      Gerekli
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Uygun
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredData.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Filtre kriterlerine uygun gösterge bulunamadı.</p>
        </Card>
      )}
    </div>
  );
}

function CriteriaReport({ data }: { data: CriteriaAnalysis[] }) {
  return (
    <div className="space-y-4">
      {data.map((item, idx) => (
        <Card key={idx} className="p-6">
          <h3 className="text-lg font-semibold mb-4">{item.criteria_category}</h3>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{item.total_responses}</div>
              <div className="text-sm text-gray-600">Toplam Yanıt</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-900">{item.indicators_with_concerns}</div>
              <div className="text-sm text-gray-600">Endişe Olan</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-900">{item.indicators_needing_update}</div>
              <div className="text-sm text-gray-600">Güncelleme Gerekli</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{item.concern_percentage}%</div>
              <div className="text-sm text-gray-600">Endişe Oranı</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full ${
                item.concern_percentage > 50 ? 'bg-red-600' :
                item.concern_percentage > 25 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${item.concern_percentage}%` }}
            />
          </div>
        </Card>
      ))}

      {data.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Kriter analizi verisi bulunmamaktadır.</p>
        </Card>
      )}
    </div>
  );
}

function ComparisonReport({ data }: { data: DepartmentComparison[] }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müdürlük</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gösterge</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İlgililik</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Etkililik</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Maliyet</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sürdürülebilirlik</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk Skoru</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlanma</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.department_name}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-600">{item.total_indicators}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.indicators_needing_relevance_update > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.indicators_needing_relevance_update}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.indicators_not_meeting_effectiveness > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.indicators_not_meeting_effectiveness}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.indicators_with_cost_issues > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.indicators_with_cost_issues}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.indicators_with_sustainability_risks > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.indicators_with_sustainability_risks}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                    item.overall_risk_score > 5
                      ? 'bg-red-600 text-white'
                      : item.overall_risk_score > 2
                      ? 'bg-yellow-500 text-white'
                      : 'bg-green-600 text-white'
                  }`}>
                    {item.overall_risk_score}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm font-medium">{item.completion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Karşılaştırma verisi bulunmamaktadır.</p>
        </Card>
      )}
    </div>
  );
}
