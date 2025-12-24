import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileDown, Building2 } from 'lucide-react';
import type { Department } from '../types/database';

interface PerformanceIndicator {
  indicator_id: string;
  indicator_code: string;
  indicator_name: string;
  measurement_unit: string;
  description: string | null;
  calculation_notes: string | null;
  data_source: string | null;
  responsible_unit: string;
  data_2024: number | null;
  data_2025_actual: number | null;
  data_2025_estimated: number | null;
  target_2025: number | null;
  target_2026: number | null;
  target_2027: number | null;
  target_2028: number | null;
}

interface ActivityCost {
  activity_id: string;
  activity_code: string;
  activity_name: string;
  economic_code: string;
  economic_code_name: string;
  financing_type: string;
  year_2025_budget: number;
  year_2025_actual: number;
  year_2025_estimated: number;
  year_2026: number;
  year_2027: number;
  year_2028: number;
}

interface ActivityDescription {
  activity_code: string;
  activity_name: string;
  legal_basis: string;
  description: string;
}

interface SubProgramData {
  id: string;
  code: string;
  name: string;
  program_code: string;
  program_name: string;
  description: string | null;
  goals: string[];
  performance_indicators: PerformanceIndicator[];
  activity_costs: ActivityCost[];
  activity_descriptions: ActivityDescription[];
}

interface DepartmentPerformanceCard {
  department_id: string;
  department_name: string;
  sub_programs: SubProgramData[];
}

export default function PerformanceCards() {
  const { user, profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [departmentCard, setDepartmentCard] = useState<DepartmentPerformanceCard | null>(null);
  const [allDepartmentCards, setAllDepartmentCards] = useState<DepartmentPerformanceCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchDepartments();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchPerformanceCards();
    }
  }, [selectedDepartmentId, fiscalYear]);

  const fetchDepartments = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name');

    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchPerformanceCards = async () => {
    if (!selectedDepartmentId) return;

    setLoading(true);
    setDepartmentCard(null);
    setAllDepartmentCards([]);

    try {
      if (selectedDepartmentId === 'all') {
        const cards: DepartmentPerformanceCard[] = [];

        for (const dept of departments) {
          const cardData = await fetchDepartmentCardData(dept.id, dept.name);
          if (cardData && cardData.sub_programs.length > 0) {
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
      console.error('Performans kartları yüklenirken hata:', error);
    }

    setLoading(false);
  };

  const fetchDepartmentCardData = async (departmentId: string, departmentName: string): Promise<DepartmentPerformanceCard | null> => {
    if (!profile?.organization_id) return null;

    try {
      const { data: mappings, error: mappingsError } = await supabase
        .from('program_activity_indicator_mappings')
        .select(`
          sub_program_id,
          sub_programs (
            id,
            code,
            name,
            program_id,
            programs (
              code,
              name
            )
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('department_id', departmentId);

      if (mappingsError) throw mappingsError;

      if (!mappings || mappings.length === 0) {
        return null;
      }

      const uniqueSubProgramIds = [...new Set(mappings.map(m => m.sub_program_id))];
      const subProgramsData: SubProgramData[] = [];

      for (const subProgramId of uniqueSubProgramIds) {
        const mapping = mappings.find(m => m.sub_program_id === subProgramId);
        if (!mapping) continue;

        const subProgram = (mapping as any).sub_programs;
        if (!subProgram) continue;

        const program = (subProgram as any).programs;

        const { data: goals } = await supabase
          .from('department_sub_program_goals')
          .select(`
            goals (
              code,
              title
            ),
            notes
          `)
          .eq('organization_id', profile.organization_id)
          .eq('department_id', departmentId)
          .eq('sub_program_id', subProgram.id)
          .order('created_at');

        const goalsList = goals?.map(g => {
          const goal = (g as any).goals;
          return goal ? `${goal.code} - ${goal.title}` : '';
        }).filter(g => g !== '') || [];

        const subProgramNotes = goals?.[0]?.notes || null;

        const { data: indicatorMappings } = await supabase
          .from('program_activity_indicator_mappings')
          .select(`
            indicator_id,
            department_id,
            indicators (
              id,
              code,
              name,
              unit,
              description,
              calculation_notes
            )
          `)
          .eq('organization_id', profile.organization_id)
          .eq('sub_program_id', subProgram.id)
          .eq('department_id', departmentId);

        const performanceIndicators: PerformanceIndicator[] = [];

        for (const indMapping of indicatorMappings || []) {
          const indicator = (indMapping as any).indicators;
          if (!indicator) continue;

          const mappingDeptId = (indMapping as any).department_id;
          let responsibleUnit = departmentName || '';

          if (mappingDeptId) {
            const { data: deptData } = await supabase
              .from('departments')
              .select('name')
              .eq('id', mappingDeptId)
              .maybeSingle();

            if (deptData) {
              responsibleUnit = deptData.name;
            }
          }

          const { data: dataEntries } = await supabase
            .from('indicator_data_entries')
            .select('period_year, value, entry_type')
            .eq('organization_id', profile.organization_id)
            .eq('indicator_id', indicator.id)
            .in('period_year', [2024, 2025]);

          const { data: targets } = await supabase
            .from('indicator_targets')
            .select('year, target_value')
            .eq('indicator_id', indicator.id)
            .in('year', [2025, 2026, 2027, 2028]);

          const data2024 = dataEntries?.find(e => e.period_year === 2024 && e.entry_type === 'actual')?.value || null;
          const data2025Actual = dataEntries?.find(e => e.period_year === 2025 && e.entry_type === 'actual')?.value || null;
          const data2025Estimated = dataEntries?.find(e => e.period_year === 2025 && e.entry_type === 'estimated')?.value || null;

          const targetMap = new Map(targets?.map(t => [t.year, t.target_value]) || []);

          performanceIndicators.push({
            indicator_id: indicator.id,
            indicator_code: indicator.code,
            indicator_name: indicator.name,
            measurement_unit: indicator.unit,
            description: indicator.description,
            calculation_notes: indicator.calculation_notes,
            data_source: null,
            responsible_unit: responsibleUnit,
            data_2024: data2024,
            data_2025_actual: data2025Actual,
            data_2025_estimated: data2025Estimated,
            target_2025: targetMap.get(2025) || null,
            target_2026: targetMap.get(2026) || null,
            target_2027: targetMap.get(2027) || null,
            target_2028: targetMap.get(2028) || null,
          });
        }

        const { data: activityMappingsForDept } = await supabase
          .from('program_activity_indicator_mappings')
          .select('activity_id')
          .eq('organization_id', profile.organization_id)
          .eq('sub_program_id', subProgram.id)
          .eq('department_id', departmentId)
          .not('activity_id', 'is', null);

        const activityIdsForDept = [...new Set(
          (activityMappingsForDept || [])
            .map(m => m.activity_id)
            .filter(Boolean)
        )];

        if (activityIdsForDept.length === 0) {
          subProgramsData.push({
            id: subProgram.id,
            code: subProgram.code,
            name: subProgram.name,
            program_code: program?.code || '',
            program_name: program?.name || '',
            description: subProgramNotes,
            goals: goalsList,
            performance_indicators: performanceIndicators,
            activity_costs: [],
            activity_descriptions: [],
          });
          continue;
        }

        const { data: activities } = await supabase
          .from('sub_program_activities')
          .select('id, activity_code, activity_name')
          .in('id', activityIdsForDept);

        const activityCosts: ActivityCost[] = [];
        const activityDescriptions: ActivityDescription[] = [];

        for (const activity of activities || []) {
          console.log('Processing activity:', activity.id, (activity as any).activity_name);

          const { data: justificationData, error: justError } = await supabase
            .from('activity_justifications')
            .select('budget_needs, legal_basis, justification')
            .eq('organization_id', profile.organization_id)
            .eq('activity_id', activity.id)
            .eq('department_id', departmentId)
            .eq('status', 'admin_approved')
            .eq('fiscal_year', fiscalYear)
            .maybeSingle();

          console.log('Justification query result:', { activity_id: activity.id, has_data: !!justificationData, error: justError });

          if (justError) {
            console.error('Faaliyet gerekçesi yükleme hatası:', justError);
          }

          const costsByCode = new Map<string, ActivityCost>();

          if (justificationData?.budget_needs) {
            const budgetNeeds = justificationData.budget_needs as any;
            const items = budgetNeeds.items || [];

            console.log('Budget needs items:', { activity_id: activity.id, count: items.length, sample: items[0] });

            for (const item of items) {
              const { data: expenseCode } = await supabase
                .from('expense_economic_codes')
                .select('full_code, name')
                .eq('id', item.economic_code_id)
                .maybeSingle();

              if (!expenseCode) {
                console.log('Skipping item - expense code not found:', item.economic_code_id);
                continue;
              }

              const key = `${expenseCode.full_code}-Bütçe İçi`;

              costsByCode.set(key, {
                activity_id: activity.id,
                activity_code: (activity as any).activity_code,
                activity_name: (activity as any).activity_name,
                economic_code: expenseCode.full_code,
                economic_code_name: expenseCode.name,
                financing_type: 'Bütçe İçi',
                year_2025_budget: 0,
                year_2025_actual: 0,
                year_2025_estimated: 0,
                year_2026: item.amount_2026 || 0,
                year_2027: item.amount_2027 || 0,
                year_2028: item.amount_2028 || 0,
              });
            }
          }

          activityCosts.push(...Array.from(costsByCode.values()));

          const { data: activityMapping } = await supabase
            .from('program_activity_indicator_mappings')
            .select('notes, description_status')
            .eq('organization_id', profile.organization_id)
            .eq('activity_id', activity.id)
            .eq('department_id', departmentId)
            .eq('description_status', 'approved')
            .maybeSingle();

          activityDescriptions.push({
            activity_code: (activity as any).activity_code,
            activity_name: (activity as any).activity_name,
            legal_basis: justificationData?.legal_basis || '-',
            description: activityMapping?.notes || justificationData?.justification || '-',
          });
        }

        subProgramsData.push({
          id: subProgram.id,
          code: subProgram.code,
          name: subProgram.name,
          program_code: program?.code || '',
          program_name: program?.name || '',
          description: subProgramNotes,
          goals: goalsList,
          performance_indicators: performanceIndicators,
          activity_costs: activityCosts,
          activity_descriptions: activityDescriptions,
        });
      }

      return {
        department_id: departmentId,
        department_name: departmentName,
        sub_programs: subProgramsData,
      };
    } catch (error) {
      console.error(`${departmentName} performans kartı yüklenirken hata:`, error);
      return null;
    }
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null || value === 0) return '-';
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToPDF = () => {
    const cardsToExport = allDepartmentCards.length > 0 ? allDepartmentCards : (departmentCard ? [departmentCard] : []);
    if (cardsToExport.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
        h1 { color: #1f2937; margin-bottom: 10px; font-size: 20px; }
        h2 { color: #374151; margin-top: 20px; margin-bottom: 10px; font-size: 14px; font-weight: 600; background-color: #dc2626; color: white; padding: 8px; }
        h3 { color: #4b5563; margin-top: 15px; margin-bottom: 8px; font-size: 12px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; font-size: 10px; }
        th { background-color: #dc2626; color: white; font-weight: 600; text-align: center; }
        .section { margin-bottom: 25px; page-break-inside: avoid; }
        .dept-header { margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #dc2626; }
        .no-data { color: #9ca3af; font-style: italic; }
        @media print {
          body { padding: 10px; }
          .section { page-break-inside: avoid; }
        }
      </style>
    `;

    const isMultipleDepartments = cardsToExport.length > 1;
    const title = isMultipleDepartments ? 'Tüm Birimler - Performans Kartları' : `Performans Kartları - ${cardsToExport[0].department_name}`;

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
          <p style="font-size: 14px; color: #1f2937;">Sorumlu Birim: <strong style="color: #dc2626;">${card.department_name}</strong></p>
        </div>
      `;

      card.sub_programs.forEach((subProgram) => {
        html += `
          <div class="section">
            <table>
              <tr>
                <th style="width: 150px;">Program Kodu</th>
                <td>${subProgram.program_code}</td>
              </tr>
              <tr>
                <th>Program Adı</th>
                <td>${subProgram.program_name}</td>
              </tr>
              <tr>
                <th>Alt Program Kodu</th>
                <td>${subProgram.code}</td>
              </tr>
              <tr>
                <th>Alt Program Adı</th>
                <td>${subProgram.name}</td>
              </tr>
            </table>

            <h2>Alt Program Hedefleri</h2>
            ${subProgram.goals.length > 0
              ? subProgram.goals.map((g, i) => `<div style="margin-left: 15px; margin-bottom: 5px;">${i + 1}. ${g}</div>`).join('')
              : '<p class="no-data">Alt program hedefi bulunmamaktadır.</p>'}

            <h2>Performans Göstergeleri</h2>
            ${subProgram.performance_indicators.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th rowspan="2">Performans Göstergesi</th>
                    <th rowspan="2">2024<br/>Gerçekleşme</th>
                    <th colspan="2">2025</th>
                    <th colspan="3">Hedef/Tahmin</th>
                  </tr>
                  <tr>
                    <th>Planlanan</th>
                    <th>Yıl Sonu Gerçekleşme Tahmini</th>
                    <th>2026 Hedef</th>
                    <th>2027 Tahmin</th>
                    <th>2028 Tahmin</th>
                  </tr>
                </thead>
                <tbody>
                  ${subProgram.performance_indicators.map(ind => `
                    <tr>
                      <td><strong>${ind.indicator_code}</strong><br/>${ind.indicator_name}<br/><em>(${ind.measurement_unit})</em></td>
                      <td style="text-align: center;">${ind.data_2024 !== null ? ind.data_2024 : '-'}</td>
                      <td style="text-align: center;">${ind.data_2025_actual !== null ? ind.data_2025_actual : '-'}</td>
                      <td style="text-align: center;">${ind.data_2025_estimated !== null ? ind.data_2025_estimated : '-'}</td>
                      <td style="text-align: center;">${ind.target_2026 !== null ? ind.target_2026 : '-'}</td>
                      <td style="text-align: center;">${ind.target_2027 !== null ? ind.target_2027 : '-'}</td>
                      <td style="text-align: center;">${ind.target_2028 !== null ? ind.target_2028 : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="no-data">Performans göstergesi bulunmamaktadır.</p>'}

            <h2>Alt Program Kapsamında Yürütülecek Faaliyet Maliyetleri</h2>
            ${subProgram.activity_costs.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Ekonomik Kod</th>
                    <th>Finansman Türü</th>
                    <th>2025 Bütçe</th>
                    <th>2025 Gerçekleşme</th>
                    <th>2025 Tahmini</th>
                    <th>2026</th>
                    <th>2027</th>
                    <th>2028</th>
                  </tr>
                </thead>
                <tbody>
                  ${subProgram.activity_costs.map(cost => `
                    <tr>
                      <td><strong>${cost.economic_code}</strong><br/>${cost.economic_code_name}</td>
                      <td>${cost.financing_type}</td>
                      <td style="text-align: right;">${formatCurrency(cost.year_2025_budget)}</td>
                      <td style="text-align: right;">${formatCurrency(cost.year_2025_actual)}</td>
                      <td style="text-align: right;">${formatCurrency(cost.year_2025_estimated)}</td>
                      <td style="text-align: right;">${formatCurrency(cost.year_2026)}</td>
                      <td style="text-align: right;">${formatCurrency(cost.year_2027)}</td>
                      <td style="text-align: right;">${formatCurrency(cost.year_2028)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="no-data">Faaliyet maliyeti bulunmamaktadır.</p>'}

            <h2>Faaliyete İlişkin Açıklamalar</h2>
            ${subProgram.activity_descriptions.length > 0
              ? subProgram.activity_descriptions.map(desc => `
                <div style="margin-bottom: 10px;">
                  <strong>Faaliyet Adı:</strong> ${desc.activity_name}<br/>
                  <strong>Faaliyet Açıklaması:</strong> ${desc.description}
                </div>
              `).join('')
              : '<p class="no-data">Faaliyet açıklaması bulunmamaktadır.</p>'}
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
    const sheetName = isMultipleDepartments ? 'Tüm Birimler' : 'Performans Kartı';

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
          th { background-color: #dc2626; color: white; font-weight: bold; }
          .dept-separator { font-size: 16pt; font-weight: bold; color: #dc2626; margin: 20px 0; background-color: #fee2e2; padding: 10px; }
          .section-title { font-size: 12pt; font-weight: bold; color: white; background-color: #dc2626; padding: 8px; margin: 10px 0; }
        </style>
      </head>
      <body>
    `;

    cardsToExport.forEach((card, cardIndex) => {
      if (cardIndex > 0) {
        html += '<br/><br/><hr/><br/>';
      }

      html += `<div class="dept-separator">Sorumlu Birim: ${card.department_name}</div>`;

      card.sub_programs.forEach((subProgram) => {
        html += `
          <table>
            <tr><td style="font-weight:bold; width:200px;">Program Kodu</td><td>${subProgram.program_code}</td></tr>
            <tr><td style="font-weight:bold;">Program Adı</td><td>${subProgram.program_name}</td></tr>
            <tr><td style="font-weight:bold;">Alt Program Kodu</td><td>${subProgram.code}</td></tr>
            <tr><td style="font-weight:bold;">Alt Program Adı</td><td>${subProgram.name}</td></tr>
          </table>
          <br/>

          <div class="section-title">Alt Program Hedefleri</div>
          <table>
            <thead><tr><th style="width:50px;">No</th><th>Hedef</th></tr></thead>
            <tbody>
        `;

        if (subProgram.goals.length > 0) {
          subProgram.goals.forEach((goal, i) => {
            html += `<tr><td>${i + 1}</td><td>${goal}</td></tr>`;
          });
        } else {
          html += '<tr><td colspan="2">Alt program hedefi bulunmamaktadır.</td></tr>';
        }

        html += '</tbody></table><br/>';

        html += '<div class="section-title">Performans Göstergeleri</div>';

        if (subProgram.performance_indicators.length > 0) {
          html += `
            <table>
              <thead>
                <tr>
                  <th rowspan="2">Performans Göstergesi</th>
                  <th rowspan="2">2024 Gerçekleşme</th>
                  <th colspan="2">2025</th>
                  <th colspan="3">Hedef/Tahmin</th>
                </tr>
                <tr>
                  <th>Planlanan</th>
                  <th>Yıl Sonu Gerçekleşme Tahmini</th>
                  <th>2026 Hedef</th>
                  <th>2027 Tahmin</th>
                  <th>2028 Tahmin</th>
                </tr>
              </thead>
              <tbody>
          `;

          subProgram.performance_indicators.forEach(ind => {
            html += `
              <tr>
                <td><strong>${ind.indicator_code}</strong><br/>${ind.indicator_name}<br/><em>(${ind.measurement_unit})</em></td>
                <td style="text-align: center;">${ind.data_2024 !== null ? ind.data_2024 : '-'}</td>
                <td style="text-align: center;">${ind.data_2025_actual !== null ? ind.data_2025_actual : '-'}</td>
                <td style="text-align: center;">${ind.data_2025_estimated !== null ? ind.data_2025_estimated : '-'}</td>
                <td style="text-align: center;">${ind.target_2026 !== null ? ind.target_2026 : '-'}</td>
                <td style="text-align: center;">${ind.target_2027 !== null ? ind.target_2027 : '-'}</td>
                <td style="text-align: center;">${ind.target_2028 !== null ? ind.target_2028 : '-'}</td>
              </tr>
            `;
          });

          html += '</tbody></table>';
        } else {
          html += '<p>Performans göstergesi bulunmamaktadır.</p>';
        }

        html += '<br/><div class="section-title">Alt Program Kapsamında Yürütülecek Faaliyet Maliyetleri</div>';

        if (subProgram.activity_costs.length > 0) {
          html += `
            <table>
              <thead>
                <tr>
                  <th>Ekonomik Kod</th>
                  <th>Finansman Türü</th>
                  <th>2025 Bütçe</th>
                  <th>2025 Gerçekleşme</th>
                  <th>2025 Tahmini</th>
                  <th>2026</th>
                  <th>2027</th>
                  <th>2028</th>
                </tr>
              </thead>
              <tbody>
          `;

          subProgram.activity_costs.forEach(cost => {
            html += `
              <tr>
                <td><strong>${cost.economic_code}</strong><br/>${cost.economic_code_name}</td>
                <td>${cost.financing_type}</td>
                <td style="text-align: right;">${formatCurrency(cost.year_2025_budget)}</td>
                <td style="text-align: right;">${formatCurrency(cost.year_2025_actual)}</td>
                <td style="text-align: right;">${formatCurrency(cost.year_2025_estimated)}</td>
                <td style="text-align: right;">${formatCurrency(cost.year_2026)}</td>
                <td style="text-align: right;">${formatCurrency(cost.year_2027)}</td>
                <td style="text-align: right;">${formatCurrency(cost.year_2028)}</td>
              </tr>
            `;
          });

          html += '</tbody></table>';
        } else {
          html += '<p>Faaliyet maliyeti bulunmamaktadır.</p>';
        }

        html += '<br/><div class="section-title">Faaliyete İlişkin Açıklamalar</div><table><thead><tr><th>Faaliyet Adı</th><th>Faaliyet Açıklaması</th></tr></thead><tbody>';

        if (subProgram.activity_descriptions.length > 0) {
          subProgram.activity_descriptions.forEach(desc => {
            html += `
              <tr>
                <td>${desc.activity_name}</td>
                <td>${desc.description}</td>
              </tr>
            `;
          });
        } else {
          html += '<tr><td colspan="2">Faaliyet açıklaması bulunmamaktadır.</td></tr>';
        }

        html += '</tbody></table><br/><br/>';
      });
    });

    html += '</body></html>';

    const fileName = isMultipleDepartments
      ? `Performans_Kartlari_Tum_Birimler_${new Date().toISOString().split('T')[0]}.xls`
      : `Performans_Karti_${cardsToExport[0].department_name}_${new Date().toISOString().split('T')[0]}.xls`;

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

  const renderDepartmentCardContent = (card: DepartmentPerformanceCard) => {
    return (
      <>
        {card.sub_programs.map((subProgram) => (
          <div key={subProgram.id} className="mb-8 pb-8 border-b border-gray-200 last:border-b-0">
            <table className="w-full mb-6">
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-white bg-red-600 w-48">
                    Bütçe Yılı
                  </td>
                  <td className="py-3 px-4">2025</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-white bg-red-600">
                    Program Adı
                  </td>
                  <td className="py-3 px-4">{subProgram.program_code} - {subProgram.program_name}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-white bg-red-600">
                    Alt Program Adı
                  </td>
                  <td className="py-3 px-4 font-semibold">{subProgram.code} - {subProgram.name}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-semibold text-white bg-red-600">
                    Gerekçe ve Açıklamalar
                  </td>
                  <td className="py-3 px-4">{subProgram.description || '-'}</td>
                </tr>
              </tbody>
            </table>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white bg-red-600 px-4 py-2 mb-3">
                Alt Program Hedefleri
              </h3>
              {subProgram.goals.length > 0 ? (
                <ul className="space-y-2 px-4">
                  {subProgram.goals.map((goal, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-gray-600 font-medium">{idx + 1}.</span>
                      <span className="text-gray-700">{goal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic px-4">Alt program hedefi bulunmamaktadır.</p>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white bg-red-600 px-4 py-2 mb-3">
                Performans Göstergeleri
              </h3>
              {subProgram.performance_indicators.length > 0 ? (
                <div className="space-y-6">
                  {subProgram.performance_indicators.map((ind, idx) => (
                    <div key={idx} className="border-2 border-gray-300 bg-white">
                      <div className="bg-gray-100 px-4 py-3 border-b-2 border-gray-300">
                        <div className="font-bold text-gray-900 text-base">
                          {idx + 1}. {ind.indicator_code} - {ind.indicator_name}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-4">
                          <div className="space-y-4">
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Göstergeye İlişkin Açıklama:</div>
                              <div className="text-gray-600">{ind.description || '-'}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Verinin Kaynağı:</div>
                              <div className="text-gray-600">{ind.data_source || <span className="text-orange-600 italic">Veri bulunmuyor</span>}</div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Hesaplama Yöntemi:</div>
                              <div className="text-gray-600">{ind.calculation_notes || <span className="text-orange-600 italic">Veri bulunmuyor</span>}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Sorumlu İdare:</div>
                              <div className="text-gray-600">{ind.responsible_unit}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4">
                        <div className="overflow-x-auto">
                          <table className="w-full border-2 border-gray-300 text-sm">
                            <thead>
                              <tr className="bg-red-600 text-white">
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  Ölçü Birimi
                                </th>
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  2024<br/>Gerçekleşme
                                </th>
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  2025<br/>Planlanan
                                </th>
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  2025 Yıl Sonu<br/>Gerçekleşme Tahmini
                                </th>
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  2026<br/>Hedef
                                </th>
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  2027<br/>Tahmin
                                </th>
                                <th className="py-3 px-3 text-center font-semibold border border-white">
                                  2028<br/>Tahmin
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-white">
                                <td className="py-3 px-3 border border-gray-300 text-center font-medium">
                                  {ind.measurement_unit}
                                </td>
                                <td className="py-3 px-3 border border-gray-300 text-center">
                                  {ind.data_2024 !== null ? ind.data_2024 : '-'}
                                </td>
                                <td className="py-3 px-3 border border-gray-300 text-center">
                                  {ind.data_2025_actual !== null ? ind.data_2025_actual : '-'}
                                </td>
                                <td className="py-3 px-3 border border-gray-300 text-center">
                                  {ind.data_2025_estimated !== null ? ind.data_2025_estimated : '-'}
                                </td>
                                <td className="py-3 px-3 border border-gray-300 text-center">
                                  {ind.target_2026 !== null ? ind.target_2026 : '-'}
                                </td>
                                <td className="py-3 px-3 border border-gray-300 text-center">
                                  {ind.target_2027 !== null ? ind.target_2027 : '-'}
                                </td>
                                <td className="py-3 px-3 border border-gray-300 text-center">
                                  {ind.target_2028 !== null ? ind.target_2028 : '-'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic px-4">Performans göstergesi bulunmamaktadır.</p>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white bg-red-600 px-4 py-3 mb-0">
                Alt Program Kapsamında Yürütülecek Faaliyet Maliyetleri
              </h3>
              {subProgram.activity_costs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-2 border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-red-600 text-white">
                        <th className="py-3 px-4 text-left font-semibold border border-white">
                          FAALİYETLER
                        </th>
                        <th className="py-3 px-3 text-center font-semibold border border-white whitespace-nowrap">
                          2025/5 Yıl<br/>Bütçe
                        </th>
                        <th className="py-3 px-3 text-center font-semibold border border-white whitespace-nowrap">
                          2025 Yıl Sonu<br/>Harcama
                        </th>
                        <th className="py-3 px-3 text-center font-semibold border border-white whitespace-nowrap">
                          2025 Yıl Sonu<br/>Har. Tah.
                        </th>
                        <th className="py-3 px-3 text-center font-semibold border border-white whitespace-nowrap">
                          2026<br/>Bütçe
                        </th>
                        <th className="py-3 px-3 text-center font-semibold border border-white whitespace-nowrap">
                          2027<br/>Tahmin
                        </th>
                        <th className="py-3 px-3 text-center font-semibold border border-white whitespace-nowrap">
                          2028<br/>Tahmin
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const groupedByActivity = subProgram.activity_costs.reduce((acc, cost) => {
                          const key = `${cost.activity_code}-${cost.activity_name}`;
                          if (!acc[key]) {
                            acc[key] = { activityCode: cost.activity_code, activityName: cost.activity_name, costs: [] };
                          }
                          acc[key].costs.push(cost);
                          return acc;
                        }, {} as Record<string, { activityCode: string; activityName: string; costs: ActivityCost[] }>);

                        return Object.values(groupedByActivity).map((group, groupIdx) => {
                          const budgetInCosts = group.costs.filter(c => c.financing_type === 'Bütçe İçi');
                          const budgetOutCosts = group.costs.filter(c => c.financing_type === 'Bütçe Dışı');

                          const calculateTotal = (costs: ActivityCost[], field: keyof ActivityCost) => {
                            return costs.reduce((sum, c) => sum + (Number(c[field]) || 0), 0);
                          };

                          const totalBudgetIn = {
                            year_2025_budget: calculateTotal(budgetInCosts, 'year_2025_budget'),
                            year_2025_actual: calculateTotal(budgetInCosts, 'year_2025_actual'),
                            year_2025_estimated: calculateTotal(budgetInCosts, 'year_2025_estimated'),
                            year_2026: calculateTotal(budgetInCosts, 'year_2026'),
                            year_2027: calculateTotal(budgetInCosts, 'year_2027'),
                            year_2028: calculateTotal(budgetInCosts, 'year_2028'),
                          };

                          const totalBudgetOut = {
                            year_2025_budget: calculateTotal(budgetOutCosts, 'year_2025_budget'),
                            year_2025_actual: calculateTotal(budgetOutCosts, 'year_2025_actual'),
                            year_2025_estimated: calculateTotal(budgetOutCosts, 'year_2025_estimated'),
                            year_2026: calculateTotal(budgetOutCosts, 'year_2026'),
                            year_2027: calculateTotal(budgetOutCosts, 'year_2027'),
                            year_2028: calculateTotal(budgetOutCosts, 'year_2028'),
                          };

                          const grandTotal = {
                            year_2025_budget: totalBudgetIn.year_2025_budget + totalBudgetOut.year_2025_budget,
                            year_2025_actual: totalBudgetIn.year_2025_actual + totalBudgetOut.year_2025_actual,
                            year_2025_estimated: totalBudgetIn.year_2025_estimated + totalBudgetOut.year_2025_estimated,
                            year_2026: totalBudgetIn.year_2026 + totalBudgetOut.year_2026,
                            year_2027: totalBudgetIn.year_2027 + totalBudgetOut.year_2027,
                            year_2028: totalBudgetIn.year_2028 + totalBudgetOut.year_2028,
                          };

                          return (
                            <React.Fragment key={groupIdx}>
                              <tr className="bg-pink-50">
                                <td colSpan={7} className="py-3 px-4 border border-gray-300 font-semibold text-gray-900">
                                  {group.activityCode} - {group.activityName}
                                </td>
                              </tr>
                              {budgetInCosts.length > 0 && (
                                <>
                                  <tr className="bg-white">
                                    <td className="py-2 px-4 border border-gray-300 pl-8">Bütçe İçi</td>
                                    <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2025_budget)}</td>
                                    <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2025_actual)}</td>
                                    <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2025_estimated)}</td>
                                    <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2026)}</td>
                                    <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2027)}</td>
                                    <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2028)}</td>
                                  </tr>
                                </>
                              )}
                              {budgetOutCosts.length > 0 && (
                                <tr className="bg-white">
                                  <td className="py-2 px-4 border border-gray-300 pl-8">Bütçe Dışı</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2025_budget)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2025_actual)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2025_estimated)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2026)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2027)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2028)}</td>
                                </tr>
                              )}
                              <tr className="bg-gray-100 font-semibold">
                                <td className="py-2 px-4 border border-gray-300">Toplam</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(grandTotal.year_2025_budget)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(grandTotal.year_2025_actual)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(grandTotal.year_2025_estimated)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(grandTotal.year_2026)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(grandTotal.year_2027)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(grandTotal.year_2028)}</td>
                              </tr>
                              <tr className="bg-gray-100 font-semibold">
                                <td className="py-2 px-4 border border-gray-300">Toplam Bütçe İçi</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2025_budget)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2025_actual)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2025_estimated)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2026)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2027)}</td>
                                <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetIn.year_2028)}</td>
                              </tr>
                              {budgetOutCosts.length > 0 && (
                                <tr className="bg-gray-100 font-semibold">
                                  <td className="py-2 px-4 border border-gray-300">Toplam Bütçe Dışı</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2025_budget)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2025_actual)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2025_estimated)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2026)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2027)}</td>
                                  <td className="py-2 px-3 border border-gray-300 text-right">{formatCurrency(totalBudgetOut.year_2028)}</td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic px-4">Faaliyet maliyeti bulunmamaktadır.</p>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white bg-red-600 px-4 py-3 mb-0">
                Faaliyete İlişkin Açıklamalar
              </h3>
              {subProgram.activity_descriptions.length > 0 ? (
                <div className="space-y-4">
                  {subProgram.activity_descriptions.map((desc, idx) => (
                    <table key={idx} className="w-full border-2 border-gray-300 text-sm">
                      <tbody>
                        <tr className="bg-pink-50">
                          <td className="py-3 px-4 border border-gray-300 font-semibold text-gray-900 w-48">
                            Faaliyet Adı
                          </td>
                          <td className="py-3 px-4 border border-gray-300 text-gray-700">
                            {desc.activity_code} - {desc.activity_name}
                          </td>
                        </tr>
                        <tr className="bg-white">
                          <td className="py-3 px-4 border border-gray-300 font-semibold text-gray-900 align-top">
                            Faaliyete İlişkin Açıklamalar
                          </td>
                          <td className="py-3 px-4 border border-gray-300 text-gray-700">
                            <div className="whitespace-pre-wrap">{desc.description}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic px-4">Faaliyet açıklaması bulunmamaktadır.</p>
              )}
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Performans Kartları</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bütçe Mali Yılı
            </label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">Performans kartları yükleniyor...</div>
        </div>
      )}

      {!loading && selectedDepartmentId && selectedDepartmentId !== 'all' && !departmentCard && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">Bu birime ait performans kartı bulunmamaktadır.</div>
        </div>
      )}

      {!loading && selectedDepartmentId === 'all' && allDepartmentCards.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">Hiçbir birimde performans kartı bulunmamaktadır.</div>
        </div>
      )}

      {!loading && allDepartmentCards.length > 0 && (
        <div className="space-y-8">
          {allDepartmentCards.map((card) => (
            <div key={card.department_id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="mb-6 pb-4 border-b-2 border-red-600">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Building2 className="w-6 h-6 text-red-600" />
                    <span className="font-semibold text-lg">Sorumlu Birim:</span>
                    <span className="font-bold text-red-600 text-xl">{card.department_name}</span>
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
            <div className="mb-6 pb-4 border-b-2 border-red-600">
              <div className="flex items-center gap-2 text-gray-700">
                <Building2 className="w-5 h-5 text-red-600" />
                <span className="font-semibold">Sorumlu Birim:</span>
                <span className="font-bold text-red-600">{departmentCard.department_name}</span>
              </div>
            </div>
            {renderDepartmentCardContent(departmentCard)}
          </div>
        </div>
      )}
    </div>
  );
}
