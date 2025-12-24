import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import {
  FileText,
  Search,
  Download,
  Eye,
  Trash2,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActionPlan {
  id: string;
  plan_code: string;
  kiks_action_id: string;
  current_situation: string;
  planned_actions: string;
  responsible_unit_id: string;
  responsible_persons: any[];
  collaboration_units: any[];
  output_result: string;
  completion_date: string;
  status: string;
  notes: string;
  approval_status: string;
  progress_percentage: number;
  created_at: string;
  departments?: { name: string };
  ic_kiks_actions?: {
    code: string;
    description: string;
    ic_kiks_sub_standards?: {
      code: string;
      title: string;
      ic_kiks_main_standards?: {
        code: string;
        title: string;
        ic_kiks_categories?: {
          code: string;
          name: string;
        };
      };
    };
  };
}

interface KIKSAction {
  id: string;
  sub_standard_id: string;
  code: string;
  description: string;
  ic_kiks_sub_standards?: {
    code: string;
    title: string;
    ic_kiks_main_standards?: {
      code: string;
      title: string;
    };
  };
}

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface SubStandard {
  id: string;
  code: string;
  title: string;
  ic_kiks_main_standards?: {
    code: string;
    title: string;
    ic_kiks_categories?: {
      code: string;
      name: string;
    };
  };
}

interface SubStandardStatus {
  id: string;
  sub_standard_id: string;
  organization_id: string;
  ic_plan_id: string;
  current_status?: string;
  provides_reasonable_assurance: boolean;
}

export default function ActionPlan() {
  const { user, profile } = useAuth();
  const { selectedPlanId, selectedPlan: icPlan, hasPlan, loading: planLoading } = useICPlan();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [allActions, setAllActions] = useState<KIKSAction[]>([]);
  const [allSubStandards, setAllSubStandards] = useState<SubStandard[]>([]);
  const [subStandardStatuses, setSubStandardStatuses] = useState<SubStandardStatus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponsibleDept, setSelectedResponsibleDept] = useState<string>('');
  const [selectedCollaborationDept, setSelectedCollaborationDept] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);

  useEffect(() => {
    if (user && profile && selectedPlanId) {
      fetchData();
    }
  }, [user, profile, selectedPlanId]);

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      planned: 'Planlandı',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      delayed: 'Gecikmiş'
    };
    return labels[status] || status;
  };

  const getApprovalStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      draft: 'Taslak',
      pending_approval: 'Onay Bekliyor',
      approved: 'Onaylandı',
      rejected: 'Reddedildi'
    };
    return labels[status] || status;
  };

  const getCategoryOrder = (categoryName: string): number => {
    const order: { [key: string]: number } = {
      'KONTROL ORTAMI STANDARTLARI': 1,
      'RİSK DEĞERLENDİRME STANDARTLARI': 2,
      'KONTROL FAALİYETLERİ STANDARTLARI': 3,
      'BİLGİ VE İLETİŞİM STANDARTLARI': 4,
      'İZLEME STANDARTLARI': 5
    };
    return order[categoryName.toUpperCase()] || 999;
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [plansRes, actionsRes, depsRes, profilesRes, subStandardsRes, statusesRes] = await Promise.all([
        supabase
          .from('ic_action_plans')
          .select(`
            *,
            departments(name),
            ic_kiks_actions(
              code,
              description,
              all_departments_responsible,
              all_departments_collaboration,
              responsible_departments,
              collaboration_departments,
              ic_kiks_sub_standards(
                code,
                title,
                ic_kiks_main_standards(
                  code,
                  title,
                  ic_kiks_categories(
                    code,
                    name
                  )
                )
              )
            )
          `)
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
          .order('created_at', { ascending: false }),
        supabase
          .from('ic_kiks_actions')
          .select(`
            *,
            ic_kiks_sub_standards(
              code,
              title,
              ic_kiks_main_standards(
                code,
                title
              )
            )
          `)
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
          .order('code'),
        supabase
          .from('departments')
          .select('id, name, is_system_unit')
          .or(`organization_id.eq.${profile.organization_id},is_system_unit.eq.true`)
          .order('is_system_unit.desc.nullslast, name'),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile.organization_id)
          .order('full_name'),
        supabase
          .from('ic_kiks_sub_standards')
          .select(`
            id,
            code,
            title,
            ic_kiks_main_standards(
              code,
              title,
              ic_kiks_categories(
                code,
                name
              )
            )
          `)
          .is('organization_id', null)
          .order('code'),
        supabase
          .from('ic_kiks_sub_standard_statuses')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
      ]);

      if (plansRes.error) console.error('Plans fetch error:', plansRes.error);
      else setActionPlans(plansRes.data || []);

      if (actionsRes.error) console.error('Actions fetch error:', actionsRes.error);
      else setAllActions(actionsRes.data || []);

      if (depsRes.error) console.error('Departments fetch error:', depsRes.error);
      else setDepartments(depsRes.data || []);

      if (profilesRes.error) console.error('Profiles fetch error:', profilesRes.error);
      else setProfiles(profilesRes.data || []);

      if (subStandardsRes.error) console.error('Sub standards fetch error:', subStandardsRes.error);
      else setAllSubStandards(subStandardsRes.data || []);

      if (statusesRes.error) console.error('Statuses fetch error:', statusesRes.error);
      else setSubStandardStatuses(statusesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data: any[][] = [];
    const merges: any[] = [];
    let currentRow = 0;

    data.push([
      'Standart Kod No',
      'Kamu İç Kontrol Standardı ve Genel Şartı',
      'Mevcut Durum',
      'Eylem Kod',
      'Öngörülen Eylem/Eylemler',
      'Sorumlu Birim/ler',
      'İşbirliği Yapılacak Birim',
      'Çıktı/Sonuç',
      'Tamamlanma Tarihi',
      'Açıklama'
    ]);
    currentRow++;

    Object.entries(groupedPlans).sort((a, b) => {
      const orderA = getCategoryOrder(a[1].categoryName);
      const orderB = getCategoryOrder(b[1].categoryName);
      return orderA - orderB;
    }).forEach(([categoryCode, categoryData]) => {
      data.push([categoryData.categoryName.toUpperCase(), '', '', '', '', '', '', '', '', '']);
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
      currentRow++;

      Object.entries(categoryData.mainStandards).sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true })).forEach(([mainCode, mainData]) => {
        data.push([`${mainCode} - ${mainData.mainTitle}`, '', '', '', '', '', '', '', '', '']);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
        currentRow++;

        Object.entries(mainData.subStandards).sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true })).forEach(([subCode, subData]) => {
          const planCount = subData.plans.length;
          const startRow = currentRow;

          if (planCount === 0) {
            const message = subData.providesReasonableAssurance
              ? 'Mevcut durum makul güvence sağlamaktadır'
              : 'Henüz eylem eklenmemiştir';

            data.push([
              subCode,
              subData.subTitle,
              subData.currentSituation || '-',
              '-',
              message,
              '-',
              '-',
              '-',
              '-',
              '-'
            ]);
            currentRow++;
          } else {
            subData.plans.forEach((plan, planIndex) => {
              if (planIndex === 0) {
                data.push([
                  subCode,
                  subData.subTitle,
                  subData.currentSituation,
                  plan.ic_kiks_actions?.code || '-',
                  plan.planned_actions,
                  getDepartmentNames(
                    plan.responsible_unit_id,
                    plan.responsible_persons,
                    plan.ic_kiks_actions?.all_departments_responsible,
                    plan.ic_kiks_actions?.responsible_departments
                  ),
                  getCollaborationDepartments(
                    plan.collaboration_units || plan.ic_kiks_actions?.collaboration_departments,
                    plan.all_departments_collaboration || plan.ic_kiks_actions?.all_departments_collaboration
                  ),
                  plan.output_result || '-',
                  plan.completion_date ? new Date(plan.completion_date).toLocaleDateString('tr-TR') : '-',
                  plan.notes || '-'
                ]);
              } else {
                data.push([
                  '',
                  '',
                  '',
                  plan.ic_kiks_actions?.code || '-',
                  plan.planned_actions,
                  getDepartmentNames(
                    plan.responsible_unit_id,
                    plan.responsible_persons,
                    plan.ic_kiks_actions?.all_departments_responsible,
                    plan.ic_kiks_actions?.responsible_departments
                  ),
                  getCollaborationDepartments(
                    plan.collaboration_units || plan.ic_kiks_actions?.collaboration_departments,
                    plan.all_departments_collaboration || plan.ic_kiks_actions?.all_departments_collaboration
                  ),
                  plan.output_result || '-',
                  plan.completion_date ? new Date(plan.completion_date).toLocaleDateString('tr-TR') : '-',
                  plan.notes || '-'
                ]);
              }
              currentRow++;
            });

            if (planCount > 1) {
              merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + planCount - 1, c: 0 } });
              merges.push({ s: { r: startRow, c: 1 }, e: { r: startRow + planCount - 1, c: 1 } });
              merges.push({ s: { r: startRow, c: 2 }, e: { r: startRow + planCount - 1, c: 2 } });
            }
          }
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!merges'] = merges;

    ws['!cols'] = [
      { wch: 15 },
      { wch: 50 },
      { wch: 40 },
      { wch: 12 },
      { wch: 50 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 }
    ];

    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'D0D0D0' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const cellStyle = {
      alignment: { vertical: 'top', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    for (let col = 0; col < 10; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = headerStyle;
      }
    }

    for (let row = 1; row < data.length; row++) {
      for (let col = 0; col < 10; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress]) {
          ws[cellAddress].s = cellStyle;
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eylem Planı');
    XLSX.writeFile(wb, `Eylem_Plani_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up engelleyici nedeniyle PDF oluşturulamadı. Lütfen pop-up engelleyiciyi devre dışı bırakın.');
      return;
    }

    let tableRows = '';
    Object.entries(groupedPlans)
      .sort((a, b) => {
        const orderA = getCategoryOrder(a[1].categoryName);
        const orderB = getCategoryOrder(b[1].categoryName);
        return orderA - orderB;
      })
      .forEach(([categoryCode, categoryData]) => {
        tableRows += `<tr><td colspan="10" class="category-header">${categoryData.categoryName.toUpperCase()}</td></tr>`;

        Object.entries(categoryData.mainStandards)
          .sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true }))
          .forEach(([mainCode, mainData]) => {
            tableRows += `<tr><td colspan="10" class="main-header">${mainCode} - ${mainData.mainTitle}</td></tr>`;

            Object.entries(mainData.subStandards)
              .sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true }))
              .forEach(([subCode, subData]) => {
                const planCount = subData.plans.length;

                if (planCount === 0) {
                  const message = subData.providesReasonableAssurance
                    ? 'Mevcut durum makul güvence sağlamaktadır'
                    : 'Henüz eylem eklenmemiştir';
                  const bgColor = subData.providesReasonableAssurance ? '#f0fdf4' : '#fef9c3';

                  tableRows += `
                    <tr style="background-color: ${bgColor};">
                      <td class="text-center">${subCode}</td>
                      <td>${subData.subTitle}</td>
                      <td>${subData.currentSituation || '-'}</td>
                      <td colspan="7" class="text-center" style="font-style: italic;">${message}</td>
                    </tr>
                  `;
                } else {
                  subData.plans.forEach((plan, planIndex) => {
                    const responsibleText = getDepartmentNames(
                      plan.responsible_unit_id,
                      plan.responsible_persons,
                      plan.ic_kiks_actions?.all_departments_responsible,
                      plan.ic_kiks_actions?.responsible_departments
                    );
                    const collaborationText = getCollaborationDepartments(
                      plan.collaboration_units || plan.ic_kiks_actions?.collaboration_departments,
                      plan.all_departments_collaboration || plan.ic_kiks_actions?.all_departments_collaboration
                    );

                    if (planIndex === 0) {
                      tableRows += `
                        <tr>
                          <td rowspan="${planCount}" class="text-center">${subCode}</td>
                          <td rowspan="${planCount}">${subData.subTitle}</td>
                          <td rowspan="${planCount}">${subData.currentSituation}</td>
                          <td class="text-center">${plan.ic_kiks_actions?.code || '-'}</td>
                          <td>${plan.planned_actions}</td>
                          <td>${responsibleText}</td>
                          <td>${collaborationText}</td>
                          <td>${plan.output_result || '-'}</td>
                          <td class="text-center">${plan.completion_date ? new Date(plan.completion_date).toLocaleDateString('tr-TR') : '-'}</td>
                          <td>${plan.notes || '-'}</td>
                        </tr>
                      `;
                    } else {
                      tableRows += `
                        <tr>
                          <td class="text-center">${plan.ic_kiks_actions?.code || '-'}</td>
                          <td>${plan.planned_actions}</td>
                          <td>${responsibleText}</td>
                          <td>${collaborationText}</td>
                          <td>${plan.output_result || '-'}</td>
                          <td class="text-center">${plan.completion_date ? new Date(plan.completion_date).toLocaleDateString('tr-TR') : '-'}</td>
                          <td>${plan.notes || '-'}</td>
                        </tr>
                      `;
                    }
                  });
                }
              });
          });
      });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Eylem Planı</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 9pt;
            margin: 0;
            padding: 20px;
          }
          .header {
            text-align: left;
            margin-bottom: 20px;
          }
          .header h1 {
            font-size: 18pt;
            margin: 0 0 10px 0;
          }
          .header p {
            margin: 3px 0;
            font-size: 10pt;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th, td {
            border: 1px solid #000;
            padding: 4px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background-color: #b4b4b4;
            font-weight: bold;
            text-align: center;
          }
          .category-header {
            background-color: #c8c8c8;
            font-weight: bold;
            text-align: left;
          }
          .main-header {
            background-color: #dcdcdc;
            font-weight: bold;
            text-align: left;
          }
          .text-center {
            text-align: center;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EYLEM PLANI</h1>
          <p>Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p>Toplam Eylem: ${filteredPlans.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Standart Kod No</th>
              <th style="width: 150px;">Kamu İç Kontrol Standardı ve Genel Şartı</th>
              <th style="width: 120px;">Mevcut Durum</th>
              <th style="width: 50px;">Eylem Kod</th>
              <th style="width: 140px;">Öngörülen Eylem/Eylemler</th>
              <th style="width: 80px;">Sorumlu Birim/ler</th>
              <th style="width: 80px;">İşbirliği Yapılacak Birim</th>
              <th style="width: 70px;">Çıktı/Sonuç</th>
              <th style="width: 60px;">Tamamlanma Tarihi</th>
              <th style="width: 80px;">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
          window.onafterprint = function() {
            window.close();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getDepartmentNames = (deptId: string, personIds: string[], allDepartments?: boolean, kiksActionDepts?: string[]) => {
    if (allDepartments === true) return 'Tüm Birimler';

    const deptNames: string[] = [];

    if (kiksActionDepts && kiksActionDepts.length > 0) {
      const actionDeptNames = kiksActionDepts
        .map(did => departments.find(d => d.id === did)?.name)
        .filter(Boolean);
      deptNames.push(...actionDeptNames);
    } else if (deptId) {
      const dept = departments.find(d => d.id === deptId);
      if (dept) deptNames.push(dept.name);
    }

    if (personIds && personIds.length > 0) {
      const personNames = personIds
        .map(pid => profiles.find(p => p.id === pid)?.full_name)
        .filter(Boolean);
      if (personNames.length > 0) {
        deptNames.push(`(${personNames.join(', ')})`);
      }
    }

    return deptNames.join(' ') || '-';
  };

  const getCollaborationDepartments = (deptIds: string[], allDepartments?: boolean) => {
    if (allDepartments === true) return 'Tüm Birimler';
    if (!deptIds || deptIds.length === 0) return '-';

    const deptNames = deptIds
      .map(did => departments.find(d => d.id === did)?.name)
      .filter(Boolean);

    return deptNames.join(', ') || '-';
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Bu eylem planını silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_action_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      alert('Eylem planı başarıyla silindi.');
      fetchData();
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme işlemi başarısız: ' + (error.message || ''));
    }
  };

  const filteredPlans = actionPlans.filter(plan => {
    const searchLower = searchTerm.toLowerCase();
    const searchMatch = (
      plan.plan_code.toLowerCase().includes(searchLower) ||
      plan.ic_kiks_actions?.code?.toLowerCase().includes(searchLower) ||
      plan.ic_kiks_actions?.description?.toLowerCase().includes(searchLower) ||
      plan.planned_actions.toLowerCase().includes(searchLower) ||
      plan.current_situation?.toLowerCase().includes(searchLower)
    );

    const responsibleMatch = !selectedResponsibleDept ||
      plan.ic_kiks_actions?.all_departments_responsible === true ||
      plan.responsible_unit_id === selectedResponsibleDept ||
      plan.ic_kiks_actions?.responsible_departments?.includes(selectedResponsibleDept) ||
      (plan.responsible_persons && plan.responsible_persons.length > 0 &&
        profiles.some(p =>
          plan.responsible_persons.includes(p.id) &&
          departments.find(d => d.id === selectedResponsibleDept)
        )
      );

    const collaborationMatch = !selectedCollaborationDept ||
      plan.ic_kiks_actions?.all_departments_collaboration === true ||
      plan.all_departments_collaboration === true ||
      plan.collaboration_units?.includes(selectedCollaborationDept) ||
      plan.ic_kiks_actions?.collaboration_departments?.includes(selectedCollaborationDept);

    return searchMatch && responsibleMatch && collaborationMatch;
  });

  interface GroupedPlans {
    [categoryCode: string]: {
      categoryName: string;
      mainStandards: {
        [mainCode: string]: {
          mainTitle: string;
          subStandards: {
            [subCode: string]: {
              subTitle: string;
              currentSituation: string;
              providesReasonableAssurance?: boolean;
              plans: ActionPlan[];
            };
          };
        };
      };
    };
  }

  const groupedPlans: GroupedPlans = {};

  filteredPlans.forEach(plan => {
    const category = plan.ic_kiks_actions?.ic_kiks_sub_standards?.ic_kiks_main_standards?.ic_kiks_categories;
    const mainStandard = plan.ic_kiks_actions?.ic_kiks_sub_standards?.ic_kiks_main_standards;
    const subStandard = plan.ic_kiks_actions?.ic_kiks_sub_standards;

    const categoryCode = category?.code || 'unknown';
    const categoryName = category?.name || 'Bilinmeyen Kategori';
    const mainCode = mainStandard?.code || 'unknown';
    const mainTitle = mainStandard?.title || 'Bilinmeyen Ana Standart';
    const subCode = subStandard?.code || 'unknown';
    const subTitle = subStandard?.title || 'Bilinmeyen Alt Standart';

    if (!groupedPlans[categoryCode]) {
      groupedPlans[categoryCode] = {
        categoryName,
        mainStandards: {}
      };
    }

    if (!groupedPlans[categoryCode].mainStandards[mainCode]) {
      groupedPlans[categoryCode].mainStandards[mainCode] = {
        mainTitle,
        subStandards: {}
      };
    }

    const subStandardStatus = subStandardStatuses.find(s => s.sub_standard_id === subStandard?.id);

    if (!groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode]) {
      groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode] = {
        subTitle,
        currentSituation: subStandardStatus?.current_status || '',
        providesReasonableAssurance: subStandardStatus?.provides_reasonable_assurance || false,
        plans: []
      };
    }

    groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode].plans.push(plan);
  });

  subStandardStatuses.forEach(status => {
    if (!status.current_status && !status.provides_reasonable_assurance) {
      return;
    }

    const subStandard = allSubStandards.find(s => s.id === status.sub_standard_id);
    if (!subStandard) {
      return;
    }

    const category = subStandard.ic_kiks_main_standards?.ic_kiks_categories;
    const mainStandard = subStandard.ic_kiks_main_standards;

    const categoryCode = category?.code || 'unknown';
    const categoryName = category?.name || 'Bilinmeyen Kategori';
    const mainCode = mainStandard?.code || 'unknown';
    const mainTitle = mainStandard?.title || 'Bilinmeyen Ana Standart';
    const subCode = subStandard.code || 'unknown';
    const subTitle = subStandard.title || 'Bilinmeyen Alt Standart';

    if (!groupedPlans[categoryCode]) {
      groupedPlans[categoryCode] = {
        categoryName,
        mainStandards: {}
      };
    }

    if (!groupedPlans[categoryCode].mainStandards[mainCode]) {
      groupedPlans[categoryCode].mainStandards[mainCode] = {
        mainTitle,
        subStandards: {}
      };
    }

    if (!groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode]) {
      groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode] = {
        subTitle,
        currentSituation: status.current_status || '',
        providesReasonableAssurance: status.provides_reasonable_assurance || false,
        plans: []
      };
    } else {
      groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode].currentSituation = status.current_status || '';
      groupedPlans[categoryCode].mainStandards[mainCode].subStandards[subCode].providesReasonableAssurance = status.provides_reasonable_assurance || false;
    }
  });

  const stats = {
    total: actionPlans.length,
    completed: actionPlans.filter(p => p.status === 'completed').length,
    inProgress: actionPlans.filter(p => p.status === 'in_progress').length,
    delayed: actionPlans.filter(p => p.status === 'delayed').length,
    pendingApproval: actionPlans.filter(p => p.approval_status === 'pending_approval').length
  };

  if (loading || planLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-blue-600" />
              Eylem Planı
            </h1>
            <p className="text-gray-600 mt-1">KİKS standartlarına uyum eylem planları</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Bilgi:</strong> Eylem planları KİKS Standartları sayfasında eylem eklenirken otomatik olarak oluşturulur.
            </p>
          </div>
        </div>

        {!hasPlan && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Eylem planlarını görüntülemek için lütfen önce sol menüden bir İç Kontrol Planı seçiniz.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasPlan && icPlan && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Seçili Plan: {icPlan.name}</h3>
                <p className="mt-1 text-sm text-green-700">
                  {icPlan.start_year} - {icPlan.end_year}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Eylem</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tamamlanan</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <FileText className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Devam Eden</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
              </div>
              <FileText className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gecikmiş</p>
                <p className="text-2xl font-bold text-red-600">{stats.delayed}</p>
              </div>
              <FileText className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Onay Bekleyen</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingApproval}</p>
              </div>
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sorumlu Birim/ler
              </label>
              <select
                value={selectedResponsibleDept}
                onChange={(e) => setSelectedResponsibleDept(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tüm Birimler</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                İşbirliği Yapılacak Birim
              </label>
              <select
                value={selectedCollaborationDept}
                onChange={(e) => setSelectedCollaborationDept(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tüm Birimler</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '100px' }}>
                  Standart Kod No
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '250px' }}>
                  Kamu İç Kontrol Standardı ve Genel Şartı
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '200px' }}>
                  Mevcut Durum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '80px' }}>
                  Eylem Kod
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '250px' }}>
                  Öngörülen Eylem/Eylemler
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '180px' }}>
                  Sorumlu Birim/ler
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '180px' }}>
                  İşbirliği Yapılacak Birim
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '150px' }}>
                  Çıktı/Sonuç
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '120px' }}>
                  Tamamlanma Tarihi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '180px' }}>
                  Açıklama
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase border border-gray-300" style={{ minWidth: '100px' }}>
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {Object.entries(groupedPlans).sort((a, b) => {
                const orderA = getCategoryOrder(a[1].categoryName);
                const orderB = getCategoryOrder(b[1].categoryName);
                return orderA - orderB;
              }).map(([categoryCode, categoryData]) => (
                <React.Fragment key={categoryCode}>
                  <tr className="bg-gray-200">
                    <td colSpan={11} className="px-4 py-3 text-sm font-bold text-gray-900 border border-gray-300">
                      {categoryData.categoryName.toUpperCase()}
                    </td>
                  </tr>

                  {Object.entries(categoryData.mainStandards).sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true })).map(([mainCode, mainData]) => (
                    <React.Fragment key={mainCode}>
                      <tr className="bg-gray-100">
                        <td colSpan={11} className="px-4 py-2 text-sm font-semibold text-gray-900 border border-gray-300">
                          {mainCode} - {mainData.mainTitle}
                        </td>
                      </tr>

                      {Object.entries(mainData.subStandards).sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true })).map(([subCode, subData]) => (
                        <React.Fragment key={subCode}>
                          {subData.plans.length === 0 ? (
                            subData.providesReasonableAssurance ? (
                              <tr className="bg-green-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 border border-gray-300" style={{ minWidth: '100px' }}>
                                  {subCode}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                  {subData.subTitle}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300" style={{ minWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                  {subData.currentSituation || '-'}
                                </td>
                                <td colSpan={8} className="px-4 py-3 text-sm font-medium text-green-800 border border-gray-300 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                                    Mevcut durum makul güvence sağlamaktadır
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr className="bg-yellow-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 border border-gray-300" style={{ minWidth: '100px' }}>
                                  {subCode}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                  {subData.subTitle}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300" style={{ minWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                  {subData.currentSituation || '-'}
                                </td>
                                <td colSpan={8} className="px-4 py-3 text-sm font-medium text-yellow-800 border border-gray-300 text-center italic">
                                  Henüz eylem eklenmemiştir
                                </td>
                              </tr>
                            )
                          ) : (
                            subData.plans.map((plan, planIndex) => (
                              <tr key={plan.id} className="hover:bg-gray-50">
                                {planIndex === 0 && (
                                  <>
                                    <td rowSpan={subData.plans.length} className="px-4 py-3 text-sm font-medium text-gray-900 border border-gray-300 align-top" style={{ minWidth: '100px' }}>
                                      {subCode}
                                    </td>
                                    <td rowSpan={subData.plans.length} className="px-4 py-3 text-sm text-gray-900 border border-gray-300 align-top" style={{ minWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                      {subData.subTitle}
                                    </td>
                                    <td rowSpan={subData.plans.length} className="px-4 py-3 text-sm text-gray-700 border border-gray-300 align-top" style={{ minWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                      {subData.currentSituation}
                                    </td>
                                  </>
                                )}
                              <td className="px-4 py-3 text-sm font-medium text-blue-600 border border-gray-300" style={{ minWidth: '80px' }}>
                                {plan.ic_kiks_actions?.code || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                {plan.planned_actions}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '180px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                {getDepartmentNames(
                                  plan.responsible_unit_id,
                                  plan.responsible_persons,
                                  plan.ic_kiks_actions?.all_departments_responsible,
                                  plan.ic_kiks_actions?.responsible_departments
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '180px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                {getCollaborationDepartments(
                                  plan.collaboration_units || plan.ic_kiks_actions?.collaboration_departments,
                                  plan.all_departments_collaboration || plan.ic_kiks_actions?.all_departments_collaboration
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '150px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                {plan.output_result || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300 whitespace-nowrap" style={{ minWidth: '120px' }}>
                                {plan.completion_date ? new Date(plan.completion_date).toLocaleDateString('tr-TR') : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300" style={{ minWidth: '180px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                {plan.notes || '-'}
                              </td>
                              <td className="px-4 py-3 border border-gray-300 text-center" style={{ minWidth: '100px' }}>
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedPlan(plan);
                                      setShowDetails(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Detaylar"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {(profile?.is_super_admin || profile?.role === 'admin') && (
                                    <button
                                      onClick={() => handleDelete(plan.id)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Sil"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPlans.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Eylem planı bulunamadı</p>
        </div>
      )}

      {showDetails && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Eylem Planı Detayları</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FileText className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4">
                  <p className="text-sm font-semibold text-blue-900">Kategori</p>
                  <p className="text-blue-800">{selectedPlan.ic_kiks_actions?.ic_kiks_sub_standards?.ic_kiks_main_standards?.ic_kiks_categories?.name || '-'}</p>
                </div>

                <div className="bg-green-50 border-l-4 border-green-600 p-4 mb-4">
                  <p className="text-sm font-semibold text-green-900">Ana Standart</p>
                  <p className="text-green-800">{selectedPlan.ic_kiks_actions?.ic_kiks_sub_standards?.ic_kiks_main_standards?.code || '-'} - {selectedPlan.ic_kiks_actions?.ic_kiks_sub_standards?.ic_kiks_main_standards?.title || '-'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Alt Standart Kod No</label>
                    <p className="text-gray-900">{selectedPlan.ic_kiks_actions?.ic_kiks_sub_standards?.code || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Eylem Kod No</label>
                    <p className="text-blue-600 font-medium">{selectedPlan.ic_kiks_actions?.code || '-'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Genel Şart / Alt Standart</label>
                  <p className="text-gray-900">{selectedPlan.ic_kiks_actions?.ic_kiks_sub_standards?.title || '-'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Mevcut Durum</label>
                  <p className="text-gray-900">{selectedPlan.current_situation || '-'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Öngörülen Eylem/Eylemler</label>
                  <p className="text-gray-900">{selectedPlan.planned_actions}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Sorumlu Birim/ler</label>
                    <p className="text-gray-900">{getDepartmentNames(selectedPlan.responsible_unit_id, selectedPlan.responsible_persons)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">İşbirliği Yapılacak Birim</label>
                    <p className="text-gray-900">{getCollaborationDepartments(selectedPlan.collaboration_units)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Çıktı/Sonuç</label>
                    <p className="text-gray-900">{selectedPlan.output_result || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tamamlanma Tarihi</label>
                    <p className="text-gray-900">{selectedPlan.completion_date ? new Date(selectedPlan.completion_date).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Notlar / Açıklama</label>
                  <p className="text-gray-900">{selectedPlan.notes || '-'}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Durum</label>
                    <p className="text-gray-900 capitalize">{selectedPlan.status}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">İlerleme</label>
                    <p className="text-gray-900">%{selectedPlan.progress_percentage}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Onay Durumu</label>
                    <p className="text-gray-900 capitalize">{selectedPlan.approval_status}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
