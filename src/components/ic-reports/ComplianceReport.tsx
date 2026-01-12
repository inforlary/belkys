import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, FileText, Loader2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';

interface ComplianceReportProps {
  planId: string;
  onClose: () => void;
}

interface ComponentData {
  id: string;
  code: string;
  name: string;
  compliance: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  total: number;
}

interface NonCompliantCondition {
  code: string;
  description: string;
  score: number;
  actionCount: number;
}

export default function ComplianceReport({ planId, onClose }: ComplianceReportProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [nonCompliantConditions, setNonCompliantConditions] = useState<NonCompliantCondition[]>([]);
  const [statistics, setStatistics] = useState({
    avgCompliance: 0,
    avgScore: 0,
    totalConditions: 0,
    compliant: 0,
    partial: 0,
    nonCompliant: 0,
    notAssessed: 0
  });

  useEffect(() => {
    loadReportData();
  }, [planId]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const [
        { data: componentsData },
        { data: standardsData },
        { data: conditionsData },
        { data: assessmentsData },
        { data: actionsData }
      ] = await Promise.all([
        supabase
          .from('ic_components')
          .select('id, code, name, order_index')
          .is('organization_id', null)
          .order('order_index'),

        supabase
          .from('ic_standards')
          .select('id, component_id')
          .order('order_index'),

        supabase
          .from('ic_general_conditions')
          .select('id, code, description, standard_id')
          .order('order_index'),

        supabase
          .from('ic_condition_assessments')
          .select('*')
          .eq('action_plan_id', planId),

        supabase
          .from('ic_actions')
          .select('id, condition_id')
          .eq('action_plan_id', planId)
      ]);

      const assessmentsMap = new Map();
      assessmentsData?.forEach(assessment => {
        assessmentsMap.set(assessment.condition_id, assessment);
      });

      const actionsCountMap = new Map<string, number>();
      actionsData?.forEach(action => {
        actionsCountMap.set(action.condition_id, (actionsCountMap.get(action.condition_id) || 0) + 1);
      });

      const conditionsMap = new Map<string, any[]>();
      conditionsData?.forEach(condition => {
        if (!conditionsMap.has(condition.standard_id)) {
          conditionsMap.set(condition.standard_id, []);
        }
        conditionsMap.get(condition.standard_id)?.push({
          ...condition,
          assessment: assessmentsMap.get(condition.id),
          actionCount: actionsCountMap.get(condition.id) || 0
        });
      });

      const standardsMap = new Map<string, string[]>();
      standardsData?.forEach(standard => {
        if (!standardsMap.has(standard.component_id)) {
          standardsMap.set(standard.component_id, []);
        }
        standardsMap.get(standard.component_id)?.push(standard.id);
      });

      const componentStats: ComponentData[] = [];
      let totalCompliant = 0;
      let totalPartial = 0;
      let totalNonCompliant = 0;
      let totalNotAssessed = 0;
      let totalScore = 0;
      let scoredCount = 0;
      const nonCompliantList: NonCompliantCondition[] = [];

      componentsData?.forEach(component => {
        const standardIds = standardsMap.get(component.id) || [];
        let compCompliant = 0;
        let compPartial = 0;
        let compNonCompliant = 0;
        let compTotal = 0;
        let compScore = 0;
        let compScored = 0;

        standardIds.forEach(standardId => {
          const conditions = conditionsMap.get(standardId) || [];
          conditions.forEach(condition => {
            compTotal++;
            if (condition.assessment) {
              if (condition.assessment.compliance_status === 'COMPLIANT') compCompliant++;
              else if (condition.assessment.compliance_status === 'PARTIAL') compPartial++;
              else if (condition.assessment.compliance_status === 'NON_COMPLIANT') {
                compNonCompliant++;
                nonCompliantList.push({
                  code: condition.code,
                  description: condition.description,
                  score: condition.assessment.compliance_score || 0,
                  actionCount: condition.actionCount
                });
              }

              if (condition.assessment.compliance_score > 0) {
                compScore += condition.assessment.compliance_score;
                compScored++;
              }
            }
          });
        });

        totalCompliant += compCompliant;
        totalPartial += compPartial;
        totalNonCompliant += compNonCompliant;
        totalScore += compScore;
        scoredCount += compScored;

        const compliance = compScored > 0 ? (compScore / compScored) * 20 : 0;

        componentStats.push({
          id: component.id,
          code: component.code,
          name: component.name,
          compliance,
          compliant: compCompliant,
          partial: compPartial,
          nonCompliant: compNonCompliant,
          total: compTotal
        });
      });

      const totalConditions = totalCompliant + totalPartial + totalNonCompliant + totalNotAssessed;
      const avgScore = scoredCount > 0 ? totalScore / scoredCount : 0;
      const avgCompliance = totalConditions > 0 ? ((totalCompliant + (totalPartial * 0.5)) / totalConditions) * 100 : 0;

      setComponents(componentStats);
      setNonCompliantConditions(nonCompliantList);
      setStatistics({
        avgCompliance,
        avgScore,
        totalConditions,
        compliant: totalCompliant,
        partial: totalPartial,
        nonCompliant: totalNonCompliant,
        notAssessed: totalNotAssessed
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRadarData = () => {
    return components.map(comp => ({
      subject: comp.code,
      value: comp.compliance,
      fullMark: 100
    }));
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['İÇ KONTROL UYUM DURUM RAPORU'],
      [''],
      ['Genel Uyum Skoru', `${statistics.avgCompliance.toFixed(0)}%`],
      ['Ortalama Puan', `${statistics.avgScore.toFixed(1)}/5`],
      ['Toplam Genel Şart', statistics.totalConditions],
      ['Sağlanan', `${statistics.compliant} (${statistics.totalConditions > 0 ? ((statistics.compliant / statistics.totalConditions) * 100).toFixed(0) : 0}%)`],
      ['Kısmen Sağlanan', `${statistics.partial} (${statistics.totalConditions > 0 ? ((statistics.partial / statistics.totalConditions) * 100).toFixed(0) : 0}%)`],
      ['Sağlanmayan', `${statistics.nonCompliant} (${statistics.totalConditions > 0 ? ((statistics.nonCompliant / statistics.totalConditions) * 100).toFixed(0) : 0}%)`]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const componentData = components.map(comp => ({
      'Bileşen': `${comp.code} - ${comp.name}`,
      'Uyum (%)': comp.compliance.toFixed(0),
      'Sağlanan': comp.compliant,
      'Kısmen Sağlanan': comp.partial,
      'Sağlanmayan': comp.nonCompliant,
      'Toplam': comp.total
    }));

    const ws2 = XLSX.utils.json_to_sheet(componentData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Bileşen Bazlı');

    const nonCompliantData = nonCompliantConditions.map(cond => ({
      'Kod': cond.code,
      'Genel Şart': cond.description,
      'Puan': cond.score,
      'Eylem Sayısı': cond.actionCount > 0 ? `${cond.actionCount} tanımlı` : '0 tanımlı'
    }));

    const ws3 = XLSX.utils.json_to_sheet(nonCompliantData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Sağlanmayan Şartlar');

    XLSX.writeFile(wb, `İç_Kontrol_Uyum_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">İç Kontrol Uyum Durum Raporu</h2>
          <p className="text-sm text-gray-600">Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">1. ÖZET İSTATİSTİKLER</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Genel Uyum Skoru</div>
            <div className="text-2xl font-bold text-blue-600">{statistics.avgCompliance.toFixed(0)}%</div>
            <div className="text-xs text-gray-500">Puan: {statistics.avgScore.toFixed(1)}/5</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Sağlanan</div>
            <div className="text-2xl font-bold text-green-600">{statistics.compliant}</div>
            <div className="text-xs text-gray-500">{statistics.totalConditions > 0 ? ((statistics.compliant / statistics.totalConditions) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Kısmen Sağlanan</div>
            <div className="text-2xl font-bold text-yellow-600">{statistics.partial}</div>
            <div className="text-xs text-gray-500">{statistics.totalConditions > 0 ? ((statistics.partial / statistics.totalConditions) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Sağlanmayan</div>
            <div className="text-2xl font-bold text-red-600">{statistics.nonCompliant}</div>
            <div className="text-xs text-gray-500">{statistics.totalConditions > 0 ? ((statistics.nonCompliant / statistics.totalConditions) * 100).toFixed(0) : 0}%</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">2. BİLEŞEN BAZLI UYUM</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bileşen</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Uyum</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sağlanan</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kısmen</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sağlanmayan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {components.map((comp) => (
                <tr key={comp.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{comp.code}. {comp.name}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">{comp.compliance.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{comp.compliant}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{comp.partial}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{comp.nonCompliant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">3. RADAR GRAFİĞİ</h3>
        <div className="bg-white border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={getRadarData()}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Uyum %" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {nonCompliantConditions.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-900 mb-3">4. SAĞLANMAYAN GENEL ŞARTLAR</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Genel Şart</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Puan</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Eylem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {nonCompliantConditions.map((cond, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cond.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cond.description}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{cond.score}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {cond.actionCount > 0 ? `${cond.actionCount} tanımlı` : '0 tanımlı'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
