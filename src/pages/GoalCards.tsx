import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileDown, Building2 } from 'lucide-react';
import type { Department } from '../types/database';

interface YearlyTarget {
  year: number;
  target_value: number | null;
  baseline_value?: number | null;
}

interface Indicator {
  code: string;
  name: string;
  measurement_unit: string;
  target_value: number | null;
  goal_impact_percentage: number | null;
  baseline_value: number | null;
  measurement_frequency: string | null;
  reporting_frequency: string | null;
  yearly_targets: YearlyTarget[];
}

interface GoalData {
  id: string;
  objective_name: string;
  goal_name: string;
  goal_description: string;
  indicators: Indicator[];
  risks: string[];
  findings: string[];
  needs: string[];
  activities: string[];
  cost_estimates: { year: number; amount: number }[];
  collaboration_departments: string[];
}

interface DepartmentCardData {
  department_id: string;
  department_name: string;
  goals: GoalData[];
}

const frequencyLabels: { [key: string]: string } = {
  monthly: 'Aylık',
  quarterly: '3 Aylık',
  semi_annual: '6 Aylık',
  annual: 'Yıllık',
};

export default function GoalCards() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [departmentCard, setDepartmentCard] = useState<DepartmentCardData | null>(null);
  const [allDepartmentCards, setAllDepartmentCards] = useState<DepartmentCardData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDepartments();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchGoalCards();
    }
  }, [selectedDepartmentId]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchGoalCards = async () => {
    if (!selectedDepartmentId) return;

    setLoading(true);
    setDepartmentCard(null);
    setAllDepartmentCards([]);

    try {
      if (selectedDepartmentId === 'all') {
        const cards: DepartmentCardData[] = [];

        for (const dept of departments) {
          const cardData = await fetchDepartmentCardData(dept.id, dept.name);
          if (cardData) {
            cards.push(cardData);
          }
        }

        setAllDepartmentCards(cards);
      } else {
        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        const cardData = await fetchDepartmentCardData(selectedDepartmentId, selectedDept?.name || '');
        if (cardData) {
          setDepartmentCard(cardData);
        }
      }
    } catch (error) {
      console.error('Hedef kartları yüklenirken hata:', error);
    }

    setLoading(false);
  };

  const fetchDepartmentCardData = async (departmentId: string, departmentName: string): Promise<DepartmentCardData | null> => {
    try {
      const { data: goals, error: goalsError } = await supabase
        .from('goals')
        .select(`
          id,
          title,
          description,
          objective_id,
          objectives (
            id,
            title
          )
        `)
        .eq('department_id', departmentId)
        .order('title');

      if (goalsError) throw goalsError;

      if (!goals || goals.length === 0) {
        return null;
      }

      const goalsData: GoalData[] = [];

      for (const goal of goals) {
        const { data: indicators, error: indicatorsError } = await supabase
          .from('indicators')
          .select('id, code, name, unit, target_value, goal_impact_percentage, baseline_value, measurement_frequency, reporting_frequency')
          .eq('goal_id', goal.id)
          .order('code');

        const indicatorsWithTargets = await Promise.all(
          (indicators || []).map(async (ind) => {
            const { data: targets } = await supabase
              .from('indicator_targets')
              .select('year, target_value, baseline_value')
              .eq('indicator_id', ind.id)
              .order('year');

            return {
              code: ind.code,
              name: ind.name,
              measurement_unit: ind.unit,
              target_value: ind.target_value,
              goal_impact_percentage: ind.goal_impact_percentage,
              baseline_value: ind.baseline_value,
              measurement_frequency: ind.measurement_frequency,
              reporting_frequency: ind.reporting_frequency,
              yearly_targets: targets || []
            };
          })
        );

        const { data: goalPlans } = await supabase
          .from('collaboration_plans')
          .select('id, all_departments')
          .eq('goal_id', goal.id);

        const planIds = goalPlans?.map(p => p.id) || [];
        const hasAllDepartments = goalPlans?.some(p => (p as any).all_departments) || false;

        let risks: string[] = [];
        let findings: string[] = [];
        let needs: string[] = [];
        let activities: string[] = [];
        let costEstimatesData: { year: number; amount: number }[] = [];
        let collaborationDepartments: string[] = [];

        if (planIds.length > 0) {
          const { data: planItems } = await supabase
            .from('collaboration_plan_items')
            .select('category, content')
            .in('plan_id', planIds);

          risks = planItems?.filter(i => i.category === 'risk').map(i => i.content) || [];
          findings = planItems?.filter(i => i.category === 'finding').map(i => i.content) || [];
          needs = planItems?.filter(i => i.category === 'need').map(i => i.content) || [];

          const { data: costEstimates } = await supabase
            .from('collaboration_plan_cost_estimates')
            .select('year, amount')
            .in('plan_id', planIds)
            .order('year');

          costEstimatesData = costEstimates || [];

          if (hasAllDepartments) {
            collaborationDepartments = ['Tüm Birimler'];
          } else {
            const { data: partners } = await supabase
              .from('collaboration_plan_partners')
              .select(`
                department_id,
                departments (name)
              `)
              .in('plan_id', planIds);

            const uniqueDepartments = new Set<string>();
            partners?.forEach(p => {
              if ((p as any).departments?.name) {
                uniqueDepartments.add((p as any).departments.name);
              }
            });
            collaborationDepartments = Array.from(uniqueDepartments);
          }
        }

        const { data: activitiesData } = await supabase
          .from('activities')
          .select('code, name, title')
          .eq('goal_id', goal.id)
          .order('code');

        activities = activitiesData?.map(a => `${a.code} - ${a.title || a.name}`) || [];

        goalsData.push({
          id: goal.id,
          objective_name: (goal.objectives as any)?.title || '',
          goal_name: goal.title,
          goal_description: goal.description || '',
          indicators: indicatorsWithTargets,
          risks,
          findings,
          needs,
          activities,
          cost_estimates: costEstimatesData,
          collaboration_departments: collaborationDepartments
        });
      }

      return {
        department_id: departmentId,
        department_name: departmentName,
        goals: goalsData
      };
    } catch (error) {
      console.error(`${departmentName} hedef kartı yüklenirken hata:`, error);
      return null;
    }
  };

  const exportToPDF = () => {
    const cardsToExport = allDepartmentCards.length > 0 ? allDepartmentCards : (departmentCard ? [departmentCard] : []);
    if (cardsToExport.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1f2937; margin-bottom: 10px; font-size: 24px; }
        h2 { color: #374151; margin-top: 30px; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
        h3 { color: #4b5563; margin-top: 20px; margin-bottom: 10px; font-size: 14px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f3f4f6; font-weight: 600; }
        .section { margin-bottom: 30px; page-break-inside: avoid; }
        .goal-section { margin-bottom: 30px; page-break-inside: avoid; }
        .list-item { margin-left: 20px; margin-bottom: 5px; font-size: 12px; }
        .no-data { color: #9ca3af; font-style: italic; font-size: 12px; }
        .dept-header { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #d1d5db; }
        @media print {
          body { padding: 10px; }
          .section { page-break-inside: avoid; }
        }
      </style>
    `;

    const isMultipleDepartments = cardsToExport.length > 1;
    const title = isMultipleDepartments ? 'Tüm Birimler - Hedef Kartları' : `Hedef Kartları - ${cardsToExport[0].department_name}`;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        ${styles}
      </head>
      <body>
    `;

    cardsToExport.forEach((card, cardIndex) => {
      if (cardIndex > 0) {
        html += '<div style="page-break-before: always;"></div>';
      }

      html += `
        <div class="dept-header">
          <p style="font-size: 14px; color: #6b7280;">Sorumlu Birim: <strong style="color: #1f2937;">${card.department_name}</strong></p>
        </div>
      `;

      card.goals.forEach((goal, index) => {
      html += `
        <div class="goal-section">
          <table>
            <tr>
              <th style="width: 150px;">Amaç</th>
              <td>${goal.objective_name}</td>
            </tr>
            <tr>
              <th>Hedef</th>
              <td><strong>${goal.goal_name}</strong></td>
            </tr>
            <tr>
              <th>Açıklama</th>
              <td>${goal.goal_description || '-'}</td>
            </tr>
            <tr>
              <th>Sorumlu Birim</th>
              <td>${card.department_name}</td>
            </tr>
            <tr>
              <th>İşbirliği Yapılacak Birim/Birimler</th>
              <td>${goal.collaboration_departments.length > 0 ? goal.collaboration_departments.join(', ') : 'Yok'}</td>
            </tr>
          </table>

          <h3>Performans Göstergeleri</h3>
          ${goal.indicators.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Gösterge Adı</th>
                  <th>Ölçü Birimi</th>
                  <th>Hedef Değer</th>
                </tr>
              </thead>
              <tbody>
                ${goal.indicators.map(ind => `
                  <tr>
                    <td>${ind.code}</td>
                    <td>${ind.name}</td>
                    <td>${ind.measurement_unit}</td>
                    <td>${ind.target_value !== null ? ind.target_value : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="no-data">Performans göstergesi bulunmamaktadır.</p>'}

          <h2>Riskler</h2>
          ${goal.risks.length > 0
            ? goal.risks.map((r, i) => `<div class="list-item">${i + 1}. ${r}</div>`).join('')
            : '<p class="no-data">Risk bulunmamaktadır.</p>'}

          <h2>Faaliyet ve Projeler</h2>
          ${goal.activities.length > 0
            ? goal.activities.map((a, i) => `<div class="list-item">${i + 1}. ${a}</div>`).join('')
            : '<p class="no-data">Faaliyet/proje bulunmamaktadır.</p>'}

          <h2>Maliyet Tahmini</h2>
          ${goal.cost_estimates.length > 0
            ? `<div class="list-item"><strong>${goal.cost_estimates.reduce((sum, c) => sum + c.amount, 0).toLocaleString('tr-TR')} ₺</strong></div>`
            : '<p class="no-data">Maliyet tahmini bulunmamaktadır.</p>'}

          <h2>Tespitler</h2>
          ${goal.findings.length > 0
            ? goal.findings.map((f, i) => `<div class="list-item">${i + 1}. ${f}</div>`).join('')
            : '<p class="no-data">Tespit bulunmamaktadır.</p>'}

          <h2>İhtiyaçlar</h2>
          ${goal.needs.length > 0
            ? goal.needs.map((n, i) => `<div class="list-item">${i + 1}. ${n}</div>`).join('')
            : '<p class="no-data">İhtiyaç bulunmamaktadır.</p>'}
        </div>
      `;
    });
    });

    html += `
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const exportToExcel = () => {
    const cardsToExport = allDepartmentCards.length > 0 ? allDepartmentCards : (departmentCard ? [departmentCard] : []);
    if (cardsToExport.length === 0) return;

    const isMultipleDepartments = cardsToExport.length > 1;
    const sheetName = isMultipleDepartments ? 'Tüm Birimler' : 'Hedef Kartı';

    let html = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${sheetName}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #2563eb; color: white; font-weight: bold; }
          .header { font-size: 18pt; font-weight: bold; color: #2563eb; margin: 20px 0; }
          .dept-separator { font-size: 20pt; font-weight: bold; color: #1e40af; margin: 30px 0 20px 0; background-color: #dbeafe; padding: 15px; }
          .section-title { font-size: 14pt; font-weight: bold; color: #1e40af; margin: 15px 0 10px 0; background-color: #e0e7ff; padding: 8px; }
          .goal-header { background-color: #dbeafe; padding: 10px; margin: 10px 0; font-weight: bold; }
          .info-row { padding: 5px; }
          .info-label { font-weight: bold; width: 200px; }
        </style>
      </head>
      <body>
    `;

    cardsToExport.forEach((card, cardIndex) => {
      if (cardIndex > 0) {
        html += '<br/><br/><hr/><br/>';
      }

      html += `<div class="dept-separator">Sorumlu Birim: ${card.department_name}</div>`;

      card.goals.forEach((goal, index) => {
      html += `
        <div class="goal-header">Hedef ${index + 1}</div>
        <table>
          <tr><td class="info-label">Amaç</td><td>${goal.objective_name}</td></tr>
          <tr><td class="info-label">Hedef</td><td>${goal.goal_name}</td></tr>
          <tr><td class="info-label">Açıklama</td><td>${goal.goal_description || '-'}</td></tr>
          <tr><td class="info-label">Sorumlu Birim</td><td>${card.department_name}</td></tr>
          <tr><td class="info-label">İşbirliği Yapılacak Birim/Birimler</td><td>${goal.collaboration_departments.length > 0 ? goal.collaboration_departments.join(', ') : 'Yok'}</td></tr>
        </table>
        <br/>
        <div class="section-title">Performans Göstergeleri</div>
      `;

      if (goal.indicators.length > 0) {
        html += `
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Gösterge Adı</th>
                <th>Ölçü Birimi</th>
                <th>Hedefe Etkisi (%)</th>
                <th>Plan Dönemi Başlangıç</th>
                <th>2025</th>
                <th>2026</th>
                <th>2027</th>
                <th>2028</th>
                <th>2029</th>
                <th>Ölçüm Sıklığı</th>
                <th>Raporlama Sıklığı</th>
              </tr>
            </thead>
            <tbody>
        `;

        goal.indicators.forEach(ind => {
          const yearlyTargetMap = new Map(
            ind.yearly_targets.map(t => [t.year, t.target_value])
          );
          const planStartValue = ind.yearly_targets.find(t => t.baseline_value !== null)?.baseline_value
            || ind.baseline_value;

          html += `
            <tr>
              <td>${ind.code}</td>
              <td>${ind.name}</td>
              <td>${ind.measurement_unit}</td>
              <td>${ind.goal_impact_percentage !== null ? ind.goal_impact_percentage : '-'}</td>
              <td>${planStartValue !== null ? planStartValue : '-'}</td>
              <td>${yearlyTargetMap.get(2025) !== undefined ? yearlyTargetMap.get(2025) : '-'}</td>
              <td>${yearlyTargetMap.get(2026) !== undefined ? yearlyTargetMap.get(2026) : '-'}</td>
              <td>${yearlyTargetMap.get(2027) !== undefined ? yearlyTargetMap.get(2027) : '-'}</td>
              <td>${yearlyTargetMap.get(2028) !== undefined ? yearlyTargetMap.get(2028) : '-'}</td>
              <td>${yearlyTargetMap.get(2029) !== undefined ? yearlyTargetMap.get(2029) : '-'}</td>
              <td>${ind.measurement_frequency ? (frequencyLabels[ind.measurement_frequency] || ind.measurement_frequency) : '-'}</td>
              <td>${ind.reporting_frequency ? (frequencyLabels[ind.reporting_frequency] || ind.reporting_frequency) : '-'}</td>
            </tr>
          `;
        });

        html += `
            </tbody>
          </table>
        `;
      } else {
        html += '<p>Performans göstergesi bulunmamaktadır.</p>';
      }
      html += `
        <div class="section-title">Riskler</div>
        <table>
          <thead><tr><th style="width:50px;">No</th><th>Açıklama</th></tr></thead>
          <tbody>
      `;
      if (goal.risks.length > 0) {
        goal.risks.forEach((r, i) => {
          html += `<tr><td>${i + 1}</td><td>${r}</td></tr>`;
        });
      } else {
        html += '<tr><td colspan="2">Risk bulunmamaktadır.</td></tr>';
      }
      html += '</tbody></table><br/>';

      html += `
        <div class="section-title">Faaliyet ve Projeler</div>
        <table>
          <thead><tr><th style="width:50px;">No</th><th>Açıklama</th></tr></thead>
          <tbody>
      `;
      if (goal.activities.length > 0) {
        goal.activities.forEach((a, i) => {
          html += `<tr><td>${i + 1}</td><td>${a}</td></tr>`;
        });
      } else {
        html += '<tr><td colspan="2">Faaliyet/proje bulunmamaktadır.</td></tr>';
      }
      html += '</tbody></table><br/>';

      html += `
        <div class="section-title">Maliyet Tahmini</div>
        <table>
          <thead><tr><th>Toplam Tutar</th></tr></thead>
          <tbody>
      `;
      if (goal.cost_estimates.length > 0) {
        const totalAmount = goal.cost_estimates.reduce((sum, c) => sum + c.amount, 0);
        html += `<tr><td style="font-weight:bold; font-size:14pt;">${totalAmount.toLocaleString('tr-TR')} ₺</td></tr>`;
      } else {
        html += '<tr><td>Maliyet tahmini bulunmamaktadır.</td></tr>';
      }
      html += '</tbody></table><br/>';

      html += `
        <div class="section-title">Tespitler</div>
        <table>
          <thead><tr><th style="width:50px;">No</th><th>Açıklama</th></tr></thead>
          <tbody>
      `;
      if (goal.findings.length > 0) {
        goal.findings.forEach((f, i) => {
          html += `<tr><td>${i + 1}</td><td>${f}</td></tr>`;
        });
      } else {
        html += '<tr><td colspan="2">Tespit bulunmamaktadır.</td></tr>';
      }
      html += '</tbody></table><br/>';

      html += `
        <div class="section-title">İhtiyaçlar</div>
        <table>
          <thead><tr><th style="width:50px;">No</th><th>Açıklama</th></tr></thead>
          <tbody>
      `;
      if (goal.needs.length > 0) {
        goal.needs.forEach((n, i) => {
          html += `<tr><td>${i + 1}</td><td>${n}</td></tr>`;
        });
      } else {
        html += '<tr><td colspan="2">İhtiyaç bulunmamaktadır.</td></tr>';
      }
      html += '</tbody></table><br/><br/>';
      });
    });

    html += '</body></html>';

    const fileName = isMultipleDepartments
      ? `Hedef_Kartlari_Tum_Birimler_${new Date().toISOString().split('T')[0]}.xls`
      : `Hedef_Karti_${cardsToExport[0].department_name}_${new Date().toISOString().split('T')[0]}.xls`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=UTF-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDepartmentCardContent = (card: DepartmentCardData) => {
    return (
      <>
        {card.goals.map((goal, index) => (
          <div key={goal.id} className="mb-8 pb-8 border-b border-gray-200 last:border-b-0">
            <table className="w-full mb-6">
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-gray-700 bg-gray-50 w-48">
                    Amaç
                  </td>
                  <td className="py-3 px-4">{goal.objective_name}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-gray-700 bg-gray-50">
                    Hedef
                  </td>
                  <td className="py-3 px-4 font-semibold">{goal.goal_name}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-gray-700 bg-gray-50">
                    Açıklama
                  </td>
                  <td className="py-3 px-4">{goal.goal_description || '-'}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-gray-700 bg-gray-50">
                    Sorumlu Birim
                  </td>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    {card.department_name}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-gray-700 bg-gray-50">
                    İşbirliği Yapılacak Birim/Birimler
                  </td>
                  <td className="py-3 px-4">
                    {goal.collaboration_departments.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {goal.collaboration_departments.map((dept, idx) => (
                          <span
                            key={idx}
                            className={dept === 'Tüm Birimler'
                              ? "bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-semibold"
                              : "bg-green-100 text-green-800 px-2 py-1 rounded text-sm"
                            }
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">Yok</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                Performans Göstergeleri
              </h3>
              {goal.indicators.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 text-sm">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300" rowSpan={2}>
                          Performans Göstergeleri
                        </th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300" rowSpan={2}>
                          Hedefe Etkisi (%)
                        </th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300" rowSpan={2}>
                          Plan Dönemi Başlangıç Değeri
                        </th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300" colSpan={5}>
                          Hedefler (Yıllık)
                        </th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300" rowSpan={2}>
                          Ölçüm Sıklığı
                        </th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300" rowSpan={2}>
                          Raporlama Sıklığı
                        </th>
                      </tr>
                      <tr className="bg-blue-50">
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300">2025</th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300">2026</th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300">2027</th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300">2028</th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-700 border border-gray-300">2029</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goal.indicators.map((ind, idx) => {
                        const yearlyTargetMap = new Map(
                          ind.yearly_targets.map(t => [t.year, t.target_value])
                        );
                        const planStartValue = ind.yearly_targets.find(t => t.baseline_value !== null)?.baseline_value
                          || ind.baseline_value;

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-2 px-3 border border-gray-300">
                              <div className="font-medium text-gray-900">{ind.code}</div>
                              <div className="text-gray-700">{ind.name}</div>
                              <div className="text-gray-500 text-xs mt-1">({ind.measurement_unit})</div>
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {ind.goal_impact_percentage !== null ? `${ind.goal_impact_percentage}%` : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {planStartValue !== null ? planStartValue : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {yearlyTargetMap.get(2025) !== undefined ? yearlyTargetMap.get(2025) : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {yearlyTargetMap.get(2026) !== undefined ? yearlyTargetMap.get(2026) : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {yearlyTargetMap.get(2027) !== undefined ? yearlyTargetMap.get(2027) : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {yearlyTargetMap.get(2028) !== undefined ? yearlyTargetMap.get(2028) : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center">
                              {yearlyTargetMap.get(2029) !== undefined ? yearlyTargetMap.get(2029) : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center text-xs">
                              {ind.measurement_frequency ? (frequencyLabels[ind.measurement_frequency] || ind.measurement_frequency) : '-'}
                            </td>
                            <td className="py-2 px-3 border border-gray-300 text-center text-xs">
                              {ind.reporting_frequency ? (frequencyLabels[ind.reporting_frequency] || ind.reporting_frequency) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic">Performans göstergesi bulunmamaktadır.</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                  Riskler
                </h3>
                {goal.risks.length > 0 ? (
                  <ul className="space-y-2">
                    {goal.risks.map((risk, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-gray-600 font-medium">{idx + 1}.</span>
                        <span className="text-gray-700">{risk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Risk bulunmamaktadır.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                  Faaliyet ve Projeler
                </h3>
                {goal.activities.length > 0 ? (
                  <ul className="space-y-2">
                    {goal.activities.map((activity, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-gray-600 font-medium">{idx + 1}.</span>
                        <span className="text-gray-700">{activity}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Faaliyet/proje bulunmamaktadır.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                  Maliyet Tahmini
                </h3>
                {goal.cost_estimates.length > 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-2xl font-bold text-blue-900">
                      {goal.cost_estimates.reduce((sum, c) => sum + c.amount, 0).toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Maliyet tahmini bulunmamaktadır.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                  Tespitler
                </h3>
                {goal.findings.length > 0 ? (
                  <ul className="space-y-2">
                    {goal.findings.map((finding, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-gray-600 font-medium">{idx + 1}.</span>
                        <span className="text-gray-700">{finding}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Tespit bulunmamaktadır.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                  İhtiyaçlar
                </h3>
                {goal.needs.length > 0 ? (
                  <ul className="space-y-2">
                    {goal.needs.map((need, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-gray-600 font-medium">{idx + 1}.</span>
                        <span className="text-gray-700">{need}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">İhtiyaç bulunmamaktadır.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hedef Kartları</h1>
        {(departmentCard || allDepartmentCards.length > 0) && (
          <div className="flex gap-3">
            <button
              onClick={exportToPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <FileDown className="w-5 h-5" />
              PDF İndir
            </button>
            <button
              onClick={exportToExcel}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Excel İndir
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Birim Seçimi
          </label>
          <select
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">Bir birim seçiniz</option>
            <option value="all" className="font-bold">📋 Tüm Birimler</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">Hedef kartları yükleniyor...</div>
        </div>
      )}

      {!loading && selectedDepartmentId && selectedDepartmentId !== 'all' && !departmentCard && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">Bu birime ait hedef kartı bulunmamaktadır.</div>
        </div>
      )}

      {!loading && selectedDepartmentId === 'all' && allDepartmentCards.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">Hiçbir birimde hedef kartı bulunmamaktadır.</div>
        </div>
      )}

      {!loading && allDepartmentCards.length > 0 && (
        <div className="space-y-8">
          {allDepartmentCards.map((card) => (
            <div key={card.department_id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="mb-6 pb-4 border-b-2 border-blue-500">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <span className="font-semibold text-lg">Sorumlu Birim:</span>
                    <span className="font-bold text-blue-600 text-xl">{card.department_name}</span>
                  </div>
                </div>
                {renderDepartmentCardContent(card)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && departmentCard && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <div className="mb-6 pb-4 border-b-2 border-gray-200">
              <div className="flex items-center gap-2 text-gray-700">
                <Building2 className="w-5 h-5" />
                <span className="font-semibold">Sorumlu Birim:</span>
                <span className="font-bold text-gray-900">{departmentCard.department_name}</span>
              </div>
            </div>
            {renderDepartmentCardContent(departmentCard)}
          </div>
        </div>
      )}
    </div>
  );
}
