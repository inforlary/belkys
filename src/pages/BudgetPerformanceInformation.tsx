import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  AlertCircle,
  Building2,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Calendar,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface EconomicCode {
  id: string;
  full_code: string;
  name: string;
  level: number;
}

interface Program {
  id: string;
  code: string;
  name: string;
}

interface SubProgram {
  id: string;
  code: string;
  name: string;
  full_code: string;
  program_id: string;
}

interface Activity {
  id: string;
  activity_code: string;
  activity_name: string;
  sub_program_id: string;
}

interface BudgetItem {
  economic_code_id: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
}

interface Justification {
  id: string;
  department_id: string;
  activity_id: string;
  budget_needs: {
    items: BudgetItem[];
  };
}

interface EconomicCodeSummary {
  code: string;
  name: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
}

interface ActivityCost {
  activity_id: string;
  activity_code: string;
  activity_name: string;
  sub_program_id: string;
  sub_program_code: string;
  sub_program_name: string;
  program_id: string;
  program_code: string;
  program_name: string;
  department_id?: string;
  department_name?: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
  economic_codes?: EconomicCodeSummary[];
}

type ViewMode = 'department' | 'program' | 'program-subprogram' | 'program-subprogram-activity';

export default function BudgetPerformanceInformation() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [selectedYear, setSelectedYear] = useState<2026 | 2027 | 2028>(2026);
  const [viewMode, setViewMode] = useState<ViewMode>('department');
  const [loading, setLoading] = useState(false);

  const [economicCodes, setEconomicCodes] = useState<Map<string, EconomicCode>>(new Map());
  const [programs, setPrograms] = useState<Map<string, Program>>(new Map());
  const [subPrograms, setSubPrograms] = useState<Map<string, SubProgram>>(new Map());
  const [activities, setActivities] = useState<Map<string, Activity>>(new Map());
  const [justifications, setJustifications] = useState<Justification[]>([]);

  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedSubPrograms, setExpandedSubPrograms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.organization_id) {
      loadInitialData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadJustifications();
    }
  }, [profile?.organization_id, selectedDepartment, fiscalYear]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDepartments(),
        loadEconomicCodes(),
        loadPrograms(),
        loadSubPrograms(),
        loadActivities()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadEconomicCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_economic_codes')
        .select('id, full_code, name, level');

      if (error) throw error;

      const codesMap = new Map<string, EconomicCode>();
      (data || []).forEach(code => {
        codesMap.set(code.id, code);
      });
      setEconomicCodes(codesMap);
    } catch (error) {
      console.error('Error loading economic codes:', error);
    }
  };

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, code, name');

      if (error) throw error;

      const programsMap = new Map<string, Program>();
      (data || []).forEach(prog => {
        programsMap.set(prog.id, prog);
      });
      setPrograms(programsMap);
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const loadSubPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_programs')
        .select('id, code, name, full_code, program_id');

      if (error) throw error;

      const subProgramsMap = new Map<string, SubProgram>();
      (data || []).forEach(sp => {
        subProgramsMap.set(sp.id, sp);
      });
      setSubPrograms(subProgramsMap);
    } catch (error) {
      console.error('Error loading sub programs:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_program_activities')
        .select('id, activity_code, activity_name, sub_program_id');

      if (error) throw error;

      const activitiesMap = new Map<string, Activity>();
      (data || []).forEach(act => {
        activitiesMap.set(act.id, act);
      });
      setActivities(activitiesMap);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const loadJustifications = async () => {
    try {
      let query = supabase
        .from('activity_justifications')
        .select('id, department_id, activity_id, budget_needs, fiscal_year')
        .eq('organization_id', profile!.organization_id)
        .eq('fiscal_year', fiscalYear);

      if (selectedDepartment !== 'all') {
        query = query.eq('department_id', selectedDepartment);
      }

      const { data, error } = await query;
      if (error) throw error;

      setJustifications(data || []);
    } catch (error) {
      console.error('Error loading justifications:', error);
    }
  };

  const getEconomicCodeLevel1Summary = (): EconomicCodeSummary[] => {
    const level1Map = new Map<string, EconomicCodeSummary>();

    justifications.forEach(just => {
      const items = just.budget_needs?.items || [];
      items.forEach(item => {
        const economicCode = economicCodes.get(item.economic_code_id);
        if (!economicCode) return;

        const level1Code = economicCode.full_code.substring(0, 2);

        if (!level1Map.has(level1Code)) {
          level1Map.set(level1Code, {
            code: level1Code,
            name: getLevel1Name(level1Code),
            amount_2026: 0,
            amount_2027: 0,
            amount_2028: 0
          });
        }

        const summary = level1Map.get(level1Code)!;
        summary.amount_2026 += item.amount_2026 || 0;
        summary.amount_2027 += item.amount_2027 || 0;
        summary.amount_2028 += item.amount_2028 || 0;
      });
    });

    return Array.from(level1Map.values()).sort((a, b) => a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' }));
  };

  const getLevel1Name = (code: string): string => {
    const level1Names: { [key: string]: string } = {
      '01': 'Personel Giderleri',
      '02': 'Sosyal Güvenlik Kurumları',
      '03': 'Mal ve Hizmet Alım Giderleri',
      '04': 'Faiz Giderleri',
      '05': 'Cari Transferler',
      '06': 'Sermaye Giderleri',
      '07': 'Sermaye Transferleri',
      '08': 'Borç Verme',
      '09': 'Yedek Ödenekler'
    };
    return level1Names[code] || `Ekonomik Kod ${code}`;
  };

  const getActivityCosts = (): ActivityCost[] => {
    const activityCostsMap = new Map<string, ActivityCost>();

    justifications.forEach(just => {
      const activity = activities.get(just.activity_id);
      if (!activity) return;

      const subProgram = subPrograms.get(activity.sub_program_id);
      if (!subProgram) return;

      const program = programs.get(subProgram.program_id);
      if (!program) return;

      const department = departments.find(d => d.id === just.department_id);

      const items = just.budget_needs?.items || [];

      const uniqueKey = `${activity.id}_${just.department_id}`;

      if (!activityCostsMap.has(uniqueKey)) {
        activityCostsMap.set(uniqueKey, {
          activity_id: activity.id,
          activity_code: activity.activity_code,
          activity_name: activity.activity_name,
          sub_program_id: subProgram.id,
          sub_program_code: subProgram.code,
          sub_program_name: subProgram.name,
          program_id: program.id,
          program_code: program.code,
          program_name: program.name,
          department_id: just.department_id,
          department_name: department?.name || 'Bilinmeyen Müdürlük',
          amount_2026: 0,
          amount_2027: 0,
          amount_2028: 0,
          economic_codes: []
        });
      }

      const actCost = activityCostsMap.get(uniqueKey)!;

      items.forEach(item => {
        actCost.amount_2026 += item.amount_2026 || 0;
        actCost.amount_2027 += item.amount_2027 || 0;
        actCost.amount_2028 += item.amount_2028 || 0;
      });
    });

    return Array.from(activityCostsMap.values());
  };

  const getProgramSummary = () => {
    const activityCosts = getActivityCosts();
    const programMap = new Map<string, { program: Program; amount_2026: number; amount_2027: number; amount_2028: number }>();

    activityCosts.forEach(ac => {
      if (!programMap.has(ac.program_id)) {
        programMap.set(ac.program_id, {
          program: { id: ac.program_id, code: ac.program_code, name: ac.program_name },
          amount_2026: 0,
          amount_2027: 0,
          amount_2028: 0
        });
      }
      const prog = programMap.get(ac.program_id)!;
      prog.amount_2026 += ac.amount_2026;
      prog.amount_2027 += ac.amount_2027;
      prog.amount_2028 += ac.amount_2028;
    });

    return Array.from(programMap.values()).sort((a, b) => a.program.code.localeCompare(b.program.code, 'tr', { numeric: true, sensitivity: 'base' }));
  };

  const getSubProgramSummary = () => {
    const activityCosts = getActivityCosts();
    const subProgramMap = new Map<string, {
      program_id: string;
      program_code: string;
      program_name: string;
      sub_program: SubProgram;
      amount_2026: number;
      amount_2027: number;
      amount_2028: number;
    }>();

    activityCosts.forEach(ac => {
      if (!subProgramMap.has(ac.sub_program_id)) {
        subProgramMap.set(ac.sub_program_id, {
          program_id: ac.program_id,
          program_code: ac.program_code,
          program_name: ac.program_name,
          sub_program: { id: ac.sub_program_id, code: ac.sub_program_code, name: ac.sub_program_name, full_code: '', program_id: ac.program_id },
          amount_2026: 0,
          amount_2027: 0,
          amount_2028: 0
        });
      }
      const sp = subProgramMap.get(ac.sub_program_id)!;
      sp.amount_2026 += ac.amount_2026;
      sp.amount_2027 += ac.amount_2027;
      sp.amount_2028 += ac.amount_2028;
    });

    const grouped = new Map<string, any[]>();
    subProgramMap.forEach((value) => {
      if (!grouped.has(value.program_id)) {
        grouped.set(value.program_id, []);
      }
      grouped.get(value.program_id)!.push(value);
    });

    return grouped;
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₺';
  };

  const toggleProgram = (programId: string) => {
    const newExpanded = new Set(expandedPrograms);
    if (newExpanded.has(programId)) {
      newExpanded.delete(programId);
    } else {
      newExpanded.add(programId);
    }
    setExpandedPrograms(newExpanded);
  };

  const toggleSubProgram = (subProgramId: string) => {
    const newExpanded = new Set(expandedSubPrograms);
    if (newExpanded.has(subProgramId)) {
      newExpanded.delete(subProgramId);
    } else {
      newExpanded.add(subProgramId);
    }
    setExpandedSubPrograms(newExpanded);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const departmentName = selectedDepartment === 'all'
      ? 'Tüm Müdürlükler'
      : departments.find(d => d.id === selectedDepartment)?.name || 'Bilinmeyen';

    if (viewMode === 'department') {
      const economicCodeData = economicCodeSummary.map(ec => ({
        'Kod': ec.code,
        'Ekonomik Kod Adı': ec.name,
        'Tutar': formatCurrency(
          selectedYear === 2026 ? ec.amount_2026 :
          selectedYear === 2027 ? ec.amount_2027 :
          ec.amount_2028
        )
      }));
      economicCodeData.push({
        'Kod': '',
        'Ekonomik Kod Adı': 'TOPLAM',
        'Tutar': formatCurrency(
          economicCodeSummary.reduce((sum, ec) =>
            sum + (selectedYear === 2026 ? ec.amount_2026 :
                   selectedYear === 2027 ? ec.amount_2027 :
                   ec.amount_2028), 0)
        )
      });
      const ws1 = XLSX.utils.json_to_sheet(economicCodeData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Ekonomik Kodlar');

      const activityData = activityCosts.map(ac => ({
        'Program': `${ac.program_code} - ${ac.program_name}`,
        'Alt Program': `${ac.sub_program_code} - ${ac.sub_program_name}`,
        'Faaliyet': `${ac.activity_code} - ${ac.activity_name}`,
        'Tutar': formatCurrency(
          selectedYear === 2026 ? ac.amount_2026 :
          selectedYear === 2027 ? ac.amount_2027 :
          ac.amount_2028
        )
      }));
      activityData.push({
        'Program': '',
        'Alt Program': '',
        'Faaliyet': 'TOPLAM',
        'Tutar': formatCurrency(
          activityCosts.reduce((sum, ac) =>
            sum + (selectedYear === 2026 ? ac.amount_2026 :
                   selectedYear === 2027 ? ac.amount_2027 :
                   ac.amount_2028), 0)
        )
      });
      const ws2 = XLSX.utils.json_to_sheet(activityData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Program-Faaliyet');
    } else if (viewMode === 'program') {
      const programData = programSummary.map(ps => ({
        'Program Kodu': ps.program.code,
        'Program Adı': ps.program.name,
        'Tutar': formatCurrency(
          selectedYear === 2026 ? ps.amount_2026 :
          selectedYear === 2027 ? ps.amount_2027 :
          ps.amount_2028
        )
      }));
      programData.push({
        'Program Kodu': '',
        'Program Adı': 'TOPLAM',
        'Tutar': formatCurrency(
          programSummary.reduce((sum, ps) =>
            sum + (selectedYear === 2026 ? ps.amount_2026 :
                   selectedYear === 2027 ? ps.amount_2027 :
                   ps.amount_2028), 0)
        )
      });
      const ws = XLSX.utils.json_to_sheet(programData);
      XLSX.utils.book_append_sheet(wb, ws, 'Programlar');
    } else if (viewMode === 'program-subprogram') {
      const data: any[] = [];
      subProgramSummary.forEach((subProgs, programId) => {
        const firstSubProg = subProgs[0];
        const programTotal = subProgs.reduce((sum, sp) =>
          sum + (selectedYear === 2026 ? sp.amount_2026 :
                 selectedYear === 2027 ? sp.amount_2027 :
                 sp.amount_2028), 0);

        data.push({
          'Program Kodu': firstSubProg.program_code,
          'Program Adı': firstSubProg.program_name,
          'Alt Program Kodu': '',
          'Alt Program Adı': '',
          'Tutar': formatCurrency(programTotal)
        });

        subProgs.forEach(sp => {
          data.push({
            'Program Kodu': '',
            'Program Adı': '',
            'Alt Program Kodu': sp.sub_program.code,
            'Alt Program Adı': sp.sub_program.name,
            'Tutar': formatCurrency(
              selectedYear === 2026 ? sp.amount_2026 :
              selectedYear === 2027 ? sp.amount_2027 :
              sp.amount_2028
            )
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Program-Alt Program');
    } else if (viewMode === 'program-subprogram-activity') {
      const data: any[] = [];
      subProgramSummary.forEach((subProgs, programId) => {
        const firstSubProg = subProgs[0];
        const programTotal = subProgs.reduce((sum, sp) =>
          sum + (selectedYear === 2026 ? sp.amount_2026 :
                 selectedYear === 2027 ? sp.amount_2027 :
                 sp.amount_2028), 0);

        data.push({
          'Program Kodu': firstSubProg.program_code,
          'Program Adı': firstSubProg.program_name,
          'Alt Program Kodu': '',
          'Alt Program Adı': '',
          'Faaliyet Kodu': '',
          'Faaliyet Adı': '',
          'Tutar': formatCurrency(programTotal)
        });

        subProgs.forEach(sp => {
          data.push({
            'Program Kodu': '',
            'Program Adı': '',
            'Alt Program Kodu': sp.sub_program.code,
            'Alt Program Adı': sp.sub_program.name,
            'Faaliyet Kodu': '',
            'Faaliyet Adı': '',
            'Tutar': formatCurrency(
              selectedYear === 2026 ? sp.amount_2026 :
              selectedYear === 2027 ? sp.amount_2027 :
              sp.amount_2028
            )
          });

          const subProgramActivities = activityCosts.filter(ac => ac.sub_program_id === sp.sub_program.id);
          subProgramActivities.forEach(ac => {
            data.push({
              'Program Kodu': '',
              'Program Adı': '',
              'Alt Program Kodu': '',
              'Alt Program Adı': '',
              'Faaliyet Kodu': ac.activity_code,
              'Faaliyet Adı': ac.activity_name,
              'Tutar': formatCurrency(
                selectedYear === 2026 ? ac.amount_2026 :
                selectedYear === 2027 ? ac.amount_2027 :
                ac.amount_2028
              )
            });
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Detaylı');
    }

    XLSX.writeFile(wb, `Bütçe_Performans_Bilgisi_${departmentName}_${selectedYear}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const departmentName = selectedDepartment === 'all'
      ? 'Tüm Müdürlükler'
      : departments.find(d => d.id === selectedDepartment)?.name || 'Bilinmeyen';

    doc.setFontSize(16);
    doc.text('Bütçe Performans Bilgisi', 14, 15);
    doc.setFontSize(11);
    doc.text(`Müdürlük: ${departmentName}`, 14, 22);
    doc.text(`Yıl: ${selectedYear}`, 14, 28);

    let currentY = 35;

    if (viewMode === 'department') {
      doc.setFontSize(12);
      doc.text('Ekonomik Kod Toplamları (1. Seviye)', 14, currentY);
      currentY += 5;

      const economicCodeRows = economicCodeSummary.map(ec => [
        ec.code,
        ec.name,
        formatCurrency(
          selectedYear === 2026 ? ec.amount_2026 :
          selectedYear === 2027 ? ec.amount_2027 :
          ec.amount_2028
        )
      ]);
      economicCodeRows.push([
        '',
        'TOPLAM',
        formatCurrency(
          economicCodeSummary.reduce((sum, ec) =>
            sum + (selectedYear === 2026 ? ec.amount_2026 :
                   selectedYear === 2027 ? ec.amount_2027 :
                   ec.amount_2028), 0)
        )
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Kod', 'Ekonomik Kod Adı', 'Tutar']],
        body: economicCodeRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fillColor: [220, 230, 250], fontStyle: 'bold' }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.text('Program/Alt Program/Faaliyet Maliyetleri', 14, currentY);
      currentY += 5;

      const activityRows = activityCosts.map(ac => [
        `${ac.program_code} - ${ac.program_name}`,
        `${ac.sub_program_code} - ${ac.sub_program_name}`,
        `${ac.activity_code} - ${ac.activity_name}`,
        formatCurrency(
          selectedYear === 2026 ? ac.amount_2026 :
          selectedYear === 2027 ? ac.amount_2027 :
          ac.amount_2028
        )
      ]);
      activityRows.push([
        '',
        '',
        'TOPLAM',
        formatCurrency(
          activityCosts.reduce((sum, ac) =>
            sum + (selectedYear === 2026 ? ac.amount_2026 :
                   selectedYear === 2027 ? ac.amount_2027 :
                   ac.amount_2028), 0)
        )
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Program', 'Alt Program', 'Faaliyet', 'Tutar']],
        body: activityRows,
        theme: 'grid',
        headStyles: { fillColor: [168, 85, 247] }
      });
    } else if (viewMode === 'program') {
      doc.setFontSize(12);
      doc.text('Program Bazlı Maliyetler', 14, currentY);
      currentY += 5;

      const programRows = programSummary.map(ps => [
        ps.program.code,
        ps.program.name,
        formatCurrency(
          selectedYear === 2026 ? ps.amount_2026 :
          selectedYear === 2027 ? ps.amount_2027 :
          ps.amount_2028
        )
      ]);
      programRows.push([
        '',
        'TOPLAM',
        formatCurrency(
          programSummary.reduce((sum, ps) =>
            sum + (selectedYear === 2026 ? ps.amount_2026 :
                   selectedYear === 2027 ? ps.amount_2027 :
                   ps.amount_2028), 0)
        )
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Program Kodu', 'Program Adı', 'Tutar']],
        body: programRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
      });
    } else if (viewMode === 'program-subprogram') {
      doc.setFontSize(12);
      doc.text('Program + Alt Program Maliyetleri', 14, currentY);
      currentY += 5;

      const rows: any[] = [];
      subProgramSummary.forEach((subProgs) => {
        const firstSubProg = subProgs[0];
        const programTotal = subProgs.reduce((sum, sp) =>
          sum + (selectedYear === 2026 ? sp.amount_2026 :
                 selectedYear === 2027 ? sp.amount_2027 :
                 sp.amount_2028), 0);

        rows.push([
          firstSubProg.program_code,
          firstSubProg.program_name,
          '',
          '',
          formatCurrency(programTotal)
        ]);

        subProgs.forEach(sp => {
          rows.push([
            '',
            '',
            sp.sub_program.code,
            sp.sub_program.name,
            formatCurrency(
              selectedYear === 2026 ? sp.amount_2026 :
              selectedYear === 2027 ? sp.amount_2027 :
              sp.amount_2028
            )
          ]);
        });
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Program Kodu', 'Program Adı', 'Alt Program Kodu', 'Alt Program Adı', 'Tutar']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] }
      });
    } else if (viewMode === 'program-subprogram-activity') {
      doc.setFontSize(12);
      doc.text('Program + Alt Program + Faaliyet Maliyetleri', 14, currentY);
      currentY += 5;

      const rows: any[] = [];
      subProgramSummary.forEach((subProgs) => {
        const firstSubProg = subProgs[0];
        const programTotal = subProgs.reduce((sum, sp) =>
          sum + (selectedYear === 2026 ? sp.amount_2026 :
                 selectedYear === 2027 ? sp.amount_2027 :
                 sp.amount_2028), 0);

        rows.push([
          firstSubProg.program_code,
          firstSubProg.program_name,
          '',
          '',
          '',
          '',
          formatCurrency(programTotal)
        ]);

        subProgs.forEach(sp => {
          rows.push([
            '',
            '',
            sp.sub_program.code,
            sp.sub_program.name,
            '',
            '',
            formatCurrency(
              selectedYear === 2026 ? sp.amount_2026 :
              selectedYear === 2027 ? sp.amount_2027 :
              sp.amount_2028
            )
          ]);

          const subProgramActivities = activityCosts.filter(ac => ac.sub_program_id === sp.sub_program.id);
          subProgramActivities.forEach(ac => {
            rows.push([
              '',
              '',
              '',
              '',
              ac.activity_code,
              ac.activity_name,
              formatCurrency(
                selectedYear === 2026 ? ac.amount_2026 :
                selectedYear === 2027 ? ac.amount_2027 :
                ac.amount_2028
              )
            ]);
          });
        });
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Program Kodu', 'Program Adı', 'Alt Program Kodu', 'Alt Program Adı', 'Faaliyet Kodu', 'Faaliyet Adı', 'Tutar']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 }
      });
    }

    doc.save(`Bütçe_Performans_Bilgisi_${departmentName}_${selectedYear}.pdf`);
  };

  if (!profile?.organization_id) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Yetkisiz Erişim</h3>
            <p className="text-sm text-red-700 mt-1">
              Bu sayfayı görüntülemek için organizasyon bilgileriniz eksik.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const economicCodeSummary = getEconomicCodeLevel1Summary();
  const activityCosts = getActivityCosts();
  const programSummary = getProgramSummary();
  const subProgramSummary = getSubProgramSummary();

  const getCounts = () => {
    const activityCosts = getActivityCosts();
    const uniquePrograms = new Set(activityCosts.map(ac => ac.program_id));
    const uniqueSubPrograms = new Set(activityCosts.map(ac => ac.sub_program_id));
    const uniqueActivities = new Set(activityCosts.map(ac => ac.activity_id));

    return {
      programCount: uniquePrograms.size,
      subProgramCount: uniqueSubPrograms.size,
      activityCount: uniqueActivities.size
    };
  };

  const counts = getCounts();

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" />
              Bütçe Performans Bilgisi
            </h1>
            <p className="text-gray-600 mt-1">
              Müdürlük ve program bazlı bütçe maliyet analizi
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="inline w-4 h-4 mr-1" />
              Müdürlük
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tüm Müdürlükler</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Bütçe Mali Yılı
            </label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Gösterilecek Yıl
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value) as 2026 | 2027 | 2028)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline w-4 h-4 mr-1" />
              Görünüm Modu
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="department">Müdürlük Bazlı</option>
              <option value="program">Program Bazlı</option>
              <option value="program-subprogram">Program + Alt Program</option>
              <option value="program-subprogram-activity">Program + Alt Program + Faaliyet</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Program Sayısı</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{counts.programCount}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Alt Program Sayısı</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{counts.subProgramCount}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Faaliyet Sayısı</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{counts.activityCount}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={exportToExcel}
            disabled={loading || justifications.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Excel İndir
          </button>
          <button
            onClick={exportToPDF}
            disabled={loading || justifications.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-5 h-5" />
            PDF İndir
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {viewMode === 'department' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-green-600 font-bold text-xl">₺</span>
                  Ekonomik Kod Toplamları (1. Seviye) - {selectedYear}
                </h2>
                {economicCodeSummary.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Veri bulunamadı
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kod
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ekonomik Kod Adı
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tutar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {economicCodeSummary.map((ec) => (
                          <tr key={ec.code} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {ec.code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {ec.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                              {formatCurrency(
                                selectedYear === 2026 ? ec.amount_2026 :
                                selectedYear === 2027 ? ec.amount_2027 :
                                ec.amount_2028
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold">
                          <td colSpan={2} className="px-6 py-4 text-sm text-gray-900">
                            TOPLAM
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700">
                            {formatCurrency(
                              economicCodeSummary.reduce((sum, ec) =>
                                sum + (selectedYear === 2026 ? ec.amount_2026 :
                                       selectedYear === 2027 ? ec.amount_2027 :
                                       ec.amount_2028), 0)
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Program/Alt Program/Faaliyet Maliyetleri - {selectedYear}
                </h2>
                {activityCosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Veri bulunamadı
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Müdürlük
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Program
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Alt Program
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Faaliyet
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tutar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {activityCosts.map((ac, idx) => (
                          <tr key={`${ac.activity_id}_${ac.department_id}_${idx}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {ac.department_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {ac.program_code} - {ac.program_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {ac.sub_program_code} - {ac.sub_program_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {ac.activity_code} - {ac.activity_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-purple-600">
                              {formatCurrency(
                                selectedYear === 2026 ? ac.amount_2026 :
                                selectedYear === 2027 ? ac.amount_2027 :
                                ac.amount_2028
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-purple-50 font-bold">
                          <td colSpan={4} className="px-6 py-4 text-sm text-gray-900">
                            TOPLAM
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-purple-700">
                            {formatCurrency(
                              activityCosts.reduce((sum, ac) =>
                                sum + (selectedYear === 2026 ? ac.amount_2026 :
                                       selectedYear === 2027 ? ac.amount_2027 :
                                       ac.amount_2028), 0)
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'program' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Program Bazlı Maliyetler - {selectedYear}
              </h2>
              {programSummary.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Veri bulunamadı
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Program Kodu
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Program Adı
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tutar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {programSummary.map((ps) => (
                        <tr key={ps.program.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ps.program.code}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {ps.program.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                            {formatCurrency(
                              selectedYear === 2026 ? ps.amount_2026 :
                              selectedYear === 2027 ? ps.amount_2027 :
                              ps.amount_2028
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 font-bold">
                        <td colSpan={2} className="px-6 py-4 text-sm text-gray-900">
                          TOPLAM
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700">
                          {formatCurrency(
                            programSummary.reduce((sum, ps) =>
                              sum + (selectedYear === 2026 ? ps.amount_2026 :
                                     selectedYear === 2027 ? ps.amount_2027 :
                                     ps.amount_2028), 0)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === 'program-subprogram' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Program + Alt Program Maliyetleri - {selectedYear}
              </h2>
              {subProgramSummary.size === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Veri bulunamadı
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(subProgramSummary.entries()).map(([programId, subProgs]) => {
                    const firstSubProg = subProgs[0];
                    const programTotal = subProgs.reduce((sum, sp) =>
                      sum + (selectedYear === 2026 ? sp.amount_2026 :
                             selectedYear === 2027 ? sp.amount_2027 :
                             sp.amount_2028), 0);
                    const isExpanded = expandedPrograms.has(programId);

                    return (
                      <div key={programId} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleProgram(programId)}
                          className="w-full bg-green-50 hover:bg-green-100 px-6 py-4 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-green-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-green-600" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {firstSubProg.program_code} - {firstSubProg.program_name}
                            </span>
                          </div>
                          <span className="font-bold text-green-700">
                            {formatCurrency(programTotal)}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="bg-white">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Alt Program Kodu
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Alt Program Adı
                                  </th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tutar
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {subProgs.map((sp) => (
                                  <tr key={sp.sub_program.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {sp.sub_program.code}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                      {sp.sub_program.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                                      {formatCurrency(
                                        selectedYear === 2026 ? sp.amount_2026 :
                                        selectedYear === 2027 ? sp.amount_2027 :
                                        sp.amount_2028
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewMode === 'program-subprogram-activity' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                Program + Alt Program + Faaliyet Maliyetleri - {selectedYear}
              </h2>
              {subProgramSummary.size === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Veri bulunamadı
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(subProgramSummary.entries()).map(([programId, subProgs]) => {
                    const firstSubProg = subProgs[0];
                    const programTotal = subProgs.reduce((sum, sp) =>
                      sum + (selectedYear === 2026 ? sp.amount_2026 :
                             selectedYear === 2027 ? sp.amount_2027 :
                             sp.amount_2028), 0);
                    const isProgramExpanded = expandedPrograms.has(programId);

                    return (
                      <div key={programId} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleProgram(programId)}
                          className="w-full bg-orange-50 hover:bg-orange-100 px-6 py-4 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isProgramExpanded ? (
                              <ChevronDown className="w-5 h-5 text-orange-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-orange-600" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {firstSubProg.program_code} - {firstSubProg.program_name}
                            </span>
                          </div>
                          <span className="font-bold text-orange-700">
                            {formatCurrency(programTotal)}
                          </span>
                        </button>

                        {isProgramExpanded && (
                          <div className="bg-white">
                            {subProgs.map((sp) => {
                              const isSubProgramExpanded = expandedSubPrograms.has(sp.sub_program.id);
                              const subProgramActivities = activityCosts.filter(ac => ac.sub_program_id === sp.sub_program.id);

                              return (
                                <div key={sp.sub_program.id} className="border-t border-gray-200">
                                  <button
                                    onClick={() => toggleSubProgram(sp.sub_program.id)}
                                    className="w-full bg-orange-25 hover:bg-gray-50 px-8 py-3 flex items-center justify-between transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      {isSubProgramExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-orange-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-orange-500" />
                                      )}
                                      <span className="font-medium text-gray-800">
                                        {sp.sub_program.code} - {sp.sub_program.name}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-orange-600">
                                      {formatCurrency(
                                        selectedYear === 2026 ? sp.amount_2026 :
                                        selectedYear === 2027 ? sp.amount_2027 :
                                        sp.amount_2028
                                      )}
                                    </span>
                                  </button>

                                  {isSubProgramExpanded && (
                                    <div className="bg-gray-50">
                                      <table className="min-w-full">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-10 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Müdürlük
                                            </th>
                                            <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Faaliyet Kodu
                                            </th>
                                            <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Faaliyet Adı
                                            </th>
                                            <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Tutar
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                          {subProgramActivities.map((ac, idx) => (
                                            <tr key={`${ac.activity_id}_${ac.department_id}_${idx}`} className="hover:bg-gray-50">
                                              <td className="px-10 py-3 text-sm text-gray-700">
                                                {ac.department_name}
                                              </td>
                                              <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {ac.activity_code}
                                              </td>
                                              <td className="px-6 py-3 text-sm text-gray-700">
                                                {ac.activity_name}
                                              </td>
                                              <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-semibold text-orange-600">
                                                {formatCurrency(
                                                  selectedYear === 2026 ? ac.amount_2026 :
                                                  selectedYear === 2027 ? ac.amount_2027 :
                                                  ac.amount_2028
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
