import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Layers, X, Save, ChevronRight, ChevronDown, Download, Upload, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import * as XLSX from 'xlsx';

interface Program {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  subPrograms?: SubProgram[];
}

interface SubProgram {
  id: string;
  program_id: string;
  code: string;
  name: string;
  description?: string;
  full_code: string;
  is_active: boolean;
  activities?: Activity[];
}

interface Activity {
  id: string;
  sub_program_id: string;
  activity_code: string;
  activity_name: string;
  is_active: boolean;
}

type ModalType = 'program' | 'subprogram';

export default function StandardProgramsManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('program');
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingSubProgram, setEditingSubProgram] = useState<SubProgram | null>(null);
  const [selectedProgramForSub, setSelectedProgramForSub] = useState<Program | null>(null);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedSubPrograms, setExpandedSubPrograms] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
  });

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [pastePreview, setPastePreview] = useState<any[]>([]);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      setLoading(true);

      const { data: programsData, error: progError } = await supabase
        .from('programs')
        .select('*')
        .is('organization_id', null);

      if (progError) throw progError;

      const { data: subProgramsData, error: subError } = await supabase
        .from('sub_programs')
        .select('*')
        .is('organization_id', null);

      if (subError) throw subError;

      const { data: activitiesData, error: actError } = await supabase
        .from('sub_program_activities')
        .select('*');

      if (actError) throw actError;

      console.log('[StandardPrograms] Loaded programs:', programsData?.length);
      console.log('[StandardPrograms] Loaded sub-programs:', subProgramsData?.length);
      console.log('[StandardPrograms] Loaded activities:', activitiesData?.length);

      const sortedActivities = (activitiesData || []).sort((a, b) => {
        const codeA = parseInt(a.activity_code) || 0;
        const codeB = parseInt(b.activity_code) || 0;
        return codeA - codeB;
      });

      const sortedSubPrograms = (subProgramsData || []).sort((a, b) => {
        const codeA = parseInt(a.code) || 0;
        const codeB = parseInt(b.code) || 0;
        return codeA - codeB;
      });

      const subProgramsWithActivities = sortedSubPrograms.map(sub => {
        const relatedActivities = sortedActivities.filter(act => {
          const actSubProgram = sortedSubPrograms.find(sp => sp.id === act.sub_program_id);
          return actSubProgram && actSubProgram.full_code === sub.full_code;
        });
        return {
          ...sub,
          activities: relatedActivities,
        };
      });

      const sortedPrograms = (programsData || []).sort((a, b) => {
        const codeA = parseInt(a.code) || 0;
        const codeB = parseInt(b.code) || 0;
        return codeA - codeB;
      });

      const programsWithSubs = sortedPrograms.map(prog => {
        const relatedSubPrograms = subProgramsWithActivities.filter(sub => {
          const subProgram = sortedSubPrograms.find(sp => sp.id === sub.id);
          if (!subProgram) return false;

          const subProgramParent = (programsData || []).find(p => p.id === subProgram.program_id);
          return subProgramParent && subProgramParent.code === prog.code;
        });

        return {
          ...prog,
          subPrograms: relatedSubPrograms,
        };
      });

      setPrograms(programsWithSubs);
    } catch (error) {
      console.error('Programlar yüklenirken hata:', error);
      alert('Programlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const toggleProgram = (id: string) => {
    const newExpanded = new Set(expandedPrograms);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPrograms(newExpanded);
  };

  const toggleSubProgram = (id: string) => {
    const newExpanded = new Set(expandedSubPrograms);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSubPrograms(newExpanded);
  };

  const handleAddProgram = () => {
    setModalType('program');
    setEditingProgram(null);
    setEditingSubProgram(null);
    setSelectedProgramForSub(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEditProgram = (program: Program) => {
    setModalType('program');
    setEditingProgram(program);
    setEditingSubProgram(null);
    setSelectedProgramForSub(null);
    setFormData({
      code: program.code,
      name: program.name,
      description: program.description || '',
      is_active: program.is_active,
    });
    setShowModal(true);
  };

  const handleAddSubProgram = (program: Program) => {
    setModalType('subprogram');
    setEditingProgram(null);
    setEditingSubProgram(null);
    setSelectedProgramForSub(program);
    setFormData({
      code: '',
      name: '',
      description: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEditSubProgram = (subProgram: SubProgram, program: Program) => {
    setModalType('subprogram');
    setEditingProgram(null);
    setEditingSubProgram(subProgram);
    setSelectedProgramForSub(program);
    setFormData({
      code: subProgram.code,
      name: subProgram.name,
      description: subProgram.description || '',
      is_active: subProgram.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('Kod ve isim alanları zorunludur');
      return;
    }

    try {
      if (modalType === 'program') {
        if (editingProgram) {
          const { error } = await supabase
            .from('programs')
            .update({
              code: formData.code,
              name: formData.name,
              description: formData.description || null,
              is_active: formData.is_active,
            })
            .eq('id', editingProgram.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('programs')
            .insert({
              organization_id: null,
              code: formData.code,
              name: formData.name,
              description: formData.description || null,
              is_active: formData.is_active,
            });

          if (error) throw error;
        }
      } else {
        if (!selectedProgramForSub) return;

        const fullCode = `${selectedProgramForSub.code}.${formData.code}`;

        if (editingSubProgram) {
          const { error } = await supabase
            .from('sub_programs')
            .update({
              code: formData.code,
              name: formData.name,
              description: formData.description || null,
              full_code: fullCode,
              is_active: formData.is_active,
            })
            .eq('id', editingSubProgram.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('sub_programs')
            .insert({
              program_id: selectedProgramForSub.id,
              code: formData.code,
              name: formData.name,
              description: formData.description || null,
              full_code: fullCode,
              is_active: formData.is_active,
            });

          if (error) throw error;
        }
      }

      setShowModal(false);
      loadPrograms();
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Kayıt başarısız: ' + (error.message || ''));
    }
  };

  const handleDeleteProgram = async (program: Program) => {
    const subCount = program.subPrograms?.length || 0;
    if (!confirm(`"${program.name}" programını silmek istediğinizden emin misiniz?${subCount > 0 ? ` ${subCount} alt program da silinecektir.` : ''}`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', program.id);

      if (error) throw error;
      loadPrograms();
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + (error.message || ''));
    }
  };

  const handleDeleteSubProgram = async (subProgram: SubProgram) => {
    if (!confirm(`"${subProgram.name}" alt programını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sub_programs')
        .delete()
        .eq('id', subProgram.id);

      if (error) throw error;
      loadPrograms();
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + (error.message || ''));
    }
  };

  const handleExportToExcel = async () => {
    try {
      const { data: allPrograms } = await supabase
        .from('programs')
        .select('*')
        .is('organization_id', null)
        .eq('is_active', true)
        .order('code');

      if (!allPrograms || allPrograms.length === 0) {
        alert('Export edilecek program bulunamadı.');
        return;
      }

      let excelData = '';

      for (const program of allPrograms) {
        excelData += `${program.code}\t\t${program.name}\t\t\n`;

        const { data: subPrograms } = await supabase
          .from('sub_programs')
          .select('*')
          .eq('program_id', program.id)
          .eq('is_active', true)
          .order('code');

        if (subPrograms && subPrograms.length > 0) {
          for (const subProgram of subPrograms) {
            excelData += `\t${subProgram.code}\t\t${subProgram.name}\t\n`;

            const { data: spActivities } = await supabase
              .from('sub_program_activities')
              .select('*')
              .eq('sub_program_id', subProgram.id)
              .eq('is_active', true)
              .order('activity_code');

            if (spActivities && spActivities.length > 0) {
              for (const activity of spActivities) {
                excelData += `\t\t${activity.activity_code}\t\t${activity.activity_name}\n`;
              }
            }
          }
        }
      }

      const blob = new Blob([excelData], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `standart-programlar-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Standart program yapısı başarıyla export edildi.');
    } catch (error: any) {
      console.error('Export hatası:', error);
      alert('Export sırasında hata oluştu: ' + error.message);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Tip': 'Program',
        'Program Kodu': '01',
        'Alt Program Kodu': '',
        'İsim': 'Genel Kamu Hizmetleri',
        'Açıklama': 'Genel kamu hizmetleri programı',
        'Aktif': 'EVET'
      },
      {
        'Tip': 'Alt Program',
        'Program Kodu': '01',
        'Alt Program Kodu': '01',
        'İsim': 'Yasama Organları',
        'Açıklama': 'Belediye meclisi hizmetleri',
        'Aktif': 'EVET'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 40 },
      { wch: 50 },
      { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programlar');
    XLSX.writeFile(wb, 'programlar_sablonu.xlsx');
  };

  const parsePasteData = () => {
    if (!pasteData.trim()) {
      alert('Lütfen Excel verisi yapıştırın.');
      return;
    }

    const lines = pasteData.trim().split('\n');
    const parsed: any[] = [];

    let currentProgram: any = null;
    let currentSubProgram: any = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      const cols = line.split('\t');

      const col0 = cols[0]?.trim();
      const col1 = cols[1]?.trim();
      const col2 = cols[2]?.trim();
      const col3 = cols[3]?.trim();
      const col4 = cols[4]?.trim();

      if (col0 && col2 && !col1) {
        currentProgram = {
          programCode: col0,
          programName: col2
        };
      }
      else if (col1 && col3 && !col0 && !col2 && currentProgram) {
        currentSubProgram = {
          ...currentProgram,
          subProgramCode: col1,
          subProgramName: col3
        };

        if (!parsed.some(p => p.programCode === currentProgram.programCode && p.subProgramCode === col1)) {
          parsed.push({
            programCode: currentProgram.programCode,
            programName: currentProgram.programName,
            subProgramCode: col1,
            subProgramName: col3,
            activityCode: '',
            activityName: ''
          });
        }
      }
      else if (col2 && col4 && !col0 && !col1 && currentSubProgram) {
        parsed.push({
          programCode: currentSubProgram.programCode,
          programName: currentSubProgram.programName,
          subProgramCode: currentSubProgram.subProgramCode,
          subProgramName: currentSubProgram.subProgramName,
          activityCode: col2,
          activityName: col4
        });
      }
    }

    if (parsed.length === 0) {
      alert('Geçerli veri bulunamadı. Lütfen Excel formatını kontrol edin.');
      return;
    }

    setPastePreview(parsed);
  };

  const handlePasteImport = async () => {
    if (pastePreview.length === 0) {
      alert('Lütfen önce veriyi önizleyin.');
      return;
    }

    if (!confirm(`${pastePreview.length} satır import edilecek. Devam etmek istiyor musunuz?`)) {
      return;
    }

    try {
      setImporting(true);

      let createdPrograms = 0;
      let createdSubPrograms = 0;
      let createdActivities = 0;
      let skipped = 0;

      const programsMap = new Map<string, string>();
      const subProgramsMap = new Map<string, string>();

      for (const row of pastePreview) {
        const { programCode, subProgramCode, activityCode, programName, subProgramName, activityName } = row;

        console.log('Processing row:', { programCode, subProgramCode, activityCode, programName, subProgramName, activityName });

        let programId = programsMap.get(programCode);

        if (!programId) {
          const { data: existingProgram } = await supabase
            .from('programs')
            .select('id')
            .is('organization_id', null)
            .eq('code', programCode)
            .maybeSingle();

          if (existingProgram) {
            programId = existingProgram.id;
          } else {
            const { data: newProgram, error: programError } = await supabase
              .from('programs')
              .insert({
                organization_id: null,
                code: programCode,
                name: programName,
                is_active: true
              })
              .select()
              .single();

            if (programError) {
              console.error('Program oluşturma hatası:', programCode, programError);
              alert(`Program oluşturma hatası (${programCode}): ${programError.message}`);
              skipped++;
              continue;
            }

            programId = newProgram.id;
            createdPrograms++;
          }

          programsMap.set(programCode, programId);
        }

        if (subProgramCode && subProgramName) {
          console.log('Creating/finding sub-program:', subProgramCode, subProgramName);
          const fullCode = `${programCode}.${subProgramCode}`;
          let subProgramId = subProgramsMap.get(fullCode);

          if (!subProgramId) {
            const { data: existingSubProgram } = await supabase
              .from('sub_programs')
              .select('id')
              .eq('program_id', programId)
              .eq('code', subProgramCode)
              .maybeSingle();

            if (existingSubProgram) {
              subProgramId = existingSubProgram.id;
            } else {
              const { data: newSubProgram, error: subProgramError } = await supabase
                .from('sub_programs')
                .insert({
                  program_id: programId,
                  organization_id: null,
                  code: subProgramCode,
                  full_code: fullCode,
                  name: subProgramName,
                  is_active: true
                })
                .select()
                .single();

              if (subProgramError) {
                console.error('Alt program oluşturma hatası:', subProgramCode, subProgramError);
                alert(`Alt program oluşturma hatası (${subProgramCode}): ${subProgramError.message}`);
                skipped++;
                continue;
              }

              console.log('Sub-program created:', newSubProgram);
              subProgramId = newSubProgram.id;
              createdSubPrograms++;
            }

            subProgramsMap.set(fullCode, subProgramId);
          }

          if (activityCode && activityName) {
            console.log('Creating activity:', activityCode, activityName, 'for sub-program:', subProgramId);
            const { data: existingActivity } = await supabase
              .from('sub_program_activities')
              .select('id')
              .eq('sub_program_id', subProgramId)
              .eq('activity_code', activityCode)
              .maybeSingle();

            if (!existingActivity) {
              const { error: activityError } = await supabase
                .from('sub_program_activities')
                .insert({
                  sub_program_id: subProgramId,
                  activity_code: activityCode,
                  activity_name: activityName,
                  is_active: true
                });

              if (activityError) {
                console.error('Faaliyet oluşturma hatası:', activityCode, activityError);
                alert(`Faaliyet oluşturma hatası (${activityCode}): ${activityError.message}`);
                skipped++;
                continue;
              }

              console.log('Activity created:', activityCode);
              createdActivities++;
            } else {
              skipped++;
            }
          }
        }
      }

      alert(
        `Import tamamlandı!\n\n` +
        `Oluşturulan Programlar: ${createdPrograms}\n` +
        `Oluşturulan Alt Programlar: ${createdSubPrograms}\n` +
        `Oluşturulan Faaliyetler: ${createdActivities}\n` +
        `Atlanan/Mevcut: ${skipped}`
      );

      setShowPasteModal(false);
      setPasteData('');
      setPastePreview([]);
      loadPrograms();
    } catch (error: any) {
      console.error('Import hatası:', error);
      alert('Import sırasında hata oluştu: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        alert('Excel dosyası boş!');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          const type = String(row['Tip']).trim();
          const programCode = String(row['Program Kodu']).trim();
          const subProgramCode = row['Alt Program Kodu'] ? String(row['Alt Program Kodu']).trim() : '';
          const name = String(row['İsim']).trim();
          const description = row['Açıklama'] ? String(row['Açıklama']).trim() : '';
          const isActive = String(row['Aktif']).toUpperCase() === 'EVET';

          if (!programCode || !name) {
            errorCount++;
            continue;
          }

          if (type === 'Program') {
            const { error } = await supabase
              .from('programs')
              .insert({
                organization_id: null,
                code: programCode,
                name,
                description: description || null,
                is_active: isActive,
              });

            if (error) {
              console.error('Kayıt hatası:', error);
              errorCount++;
            } else {
              successCount++;
            }
          } else if (type === 'Alt Program' && subProgramCode) {
            await loadPrograms();

            const program = programs.find(p => p.code === programCode);
            if (!program) {
              console.error('Program bulunamadı:', programCode);
              errorCount++;
              continue;
            }

            const fullCode = `${programCode}.${subProgramCode}`;

            const { error } = await supabase
              .from('sub_programs')
              .insert({
                program_id: program.id,
                code: subProgramCode,
                name,
                description: description || null,
                full_code: fullCode,
                is_active: isActive,
              });

            if (error) {
              console.error('Kayıt hatası:', error);
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error('Satır işleme hatası:', err);
          errorCount++;
        }
      }

      alert(`İçe aktarma tamamlandı!\nBaşarılı: ${successCount}\nHatalı: ${errorCount}`);
      loadPrograms();
    } catch (error: any) {
      console.error('Excel okuma hatası:', error);
      alert('Excel dosyası okunamadı: ' + (error.message || ''));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Standart Programlar ve Alt Programlar</h3>
          <p className="text-sm text-gray-600 mt-1">
            Tüm belediyeler için geçerli olan program yapısı
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={handleExportToExcel}
            variant="outline"
            className="flex items-center gap-2 border-orange-500 text-orange-700 hover:bg-orange-50"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </Button>
          <Button
            onClick={() => setShowPasteModal(true)}
            variant="outline"
            className="flex items-center gap-2 border-green-500 text-green-700 hover:bg-green-50"
          >
            <Upload className="w-4 h-4" />
            Excel'den Aktar
          </Button>
          <Button onClick={handleAddProgram} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yeni Program Ekle
          </Button>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600 font-medium">Henüz program eklenmemiş</p>
          <Button onClick={handleAddProgram} className="mt-4 flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" />
            İlk Programı Ekle
          </Button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {programs.map((program) => {
            const isExpanded = expandedPrograms.has(program.id);
            const hasSubPrograms = program.subPrograms && program.subPrograms.length > 0;

            return (
              <div key={program.id}>
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 border-b bg-blue-50">
                  <div className="flex items-center gap-3 flex-1">
                    {hasSubPrograms ? (
                      <button
                        onClick={() => toggleProgram(program.id)}
                        className="p-1 hover:bg-blue-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-blue-600" />
                        )}
                      </button>
                    ) : (
                      <div className="w-7" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-mono font-bold text-blue-900 bg-blue-200 px-3 py-1 rounded">
                          {program.code}
                        </span>
                        <span className="text-base font-semibold text-gray-900">{program.name}</span>
                        {program.description && (
                          <span className="text-sm text-gray-600">- {program.description}</span>
                        )}
                        {program.is_active ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Pasif
                          </span>
                        )}
                        {hasSubPrograms && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {program.subPrograms!.length} alt program
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddSubProgram(program)}
                      className="text-green-600 hover:text-green-800 p-2 hover:bg-green-50 rounded"
                      title="Alt Program Ekle"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditProgram(program)}
                      className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                      title="Düzenle"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(program)}
                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {hasSubPrograms && isExpanded && (
                  <div className="bg-gray-50">
                    {program.subPrograms!.map((subProgram) => {
                      const isSubExpanded = expandedSubPrograms.has(subProgram.id);
                      const hasActivities = subProgram.activities && subProgram.activities.length > 0;

                      return (
                        <div key={subProgram.id}>
                          <div className="flex items-center justify-between p-3 pl-16 hover:bg-gray-100 border-b">
                            <div className="flex items-center gap-3 flex-1">
                              {hasActivities ? (
                                <button
                                  onClick={() => toggleSubProgram(subProgram.id)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  {isSubExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-6" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-mono font-medium text-gray-900 bg-gray-200 px-2 py-1 rounded">
                                    {subProgram.full_code}
                                  </span>
                                  <span className="text-sm text-gray-900">{subProgram.name}</span>
                                  {subProgram.description && (
                                    <span className="text-xs text-gray-600">- {subProgram.description}</span>
                                  )}
                                  {subProgram.is_active ? (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                      Aktif
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                      Pasif
                                    </span>
                                  )}
                                  {hasActivities && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                      {subProgram.activities!.length} faaliyet
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditSubProgram(subProgram, program)}
                                className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                title="Düzenle"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSubProgram(subProgram)}
                                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {hasActivities && isSubExpanded && (
                            <div className="bg-white">
                              {subProgram.activities!.map((activity) => (
                                <div
                                  key={activity.id}
                                  className="flex items-center gap-3 p-2 pl-32 hover:bg-gray-50 border-b border-gray-100 text-sm"
                                >
                                  <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                    {activity.activity_code}
                                  </span>
                                  <span className="text-gray-800">{activity.activity_name}</span>
                                  {activity.is_active ? (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                      Aktif
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                      Pasif
                                    </span>
                                  )}
                                </div>
                              ))}
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

      {showPasteModal && (
        <Modal
          isOpen={showPasteModal}
          onClose={() => {
            setShowPasteModal(false);
            setPasteData('');
            setPastePreview([]);
          }}
          title="Excel'den Yapıştır"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <FileText className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-2">Excel Formatı (5 Sütunlu):</p>
                  <div className="space-y-2 text-blue-800">
                    <div className="bg-white bg-opacity-50 p-2 rounded font-mono text-xs">
                      <div className="mb-2 text-blue-900">Sütun Yapısı:</div>
                      <div>A: Program Kodu</div>
                      <div>B: Alt Program Kodu</div>
                      <div>C: Program Adı / Faaliyet Kodu (seviyeye göre)</div>
                      <div>D: Alt Program Adı</div>
                      <div>E: Faaliyet Adı</div>
                    </div>
                    <p className="font-medium mt-2">Örnek:</p>
                    <div className="bg-white bg-opacity-50 p-2 rounded text-xs space-y-1">
                      <div>Program: <span className="font-mono">3 [TAB] [TAB] AİLENİN KORUNMASI VE GÜÇLENDİRİLMESİ [TAB] [TAB]</span></div>
                      <div>Alt Program: <span className="font-mono">[TAB] 16 [TAB] [TAB] AİLENİN GÜÇLENDİRİLMESİ [TAB]</span></div>
                      <div>Faaliyet: <span className="font-mono">[TAB] [TAB] 48 [TAB] [TAB] Aileye Yönelik Eğitim Hizmetleri</span></div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium">
                    Excel'den A-E sütunlarını seçip kopyalayın (Ctrl+C), buraya yapıştırın (Ctrl+V)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel Verisi
              </label>
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                rows={10}
                placeholder="Excel'den veriyi buraya yapıştırın..."
              />
            </div>

            {pastePreview.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="font-medium text-gray-900">
                    Önizleme ({pastePreview.length} satır)
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-60">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Program
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Alt Program
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Faaliyet
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pastePreview.slice(0, 20).map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {row.programCode}
                            </div>
                            <div className="text-xs text-gray-500">
                              {row.programName}
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {row.subProgramCode}
                            </div>
                            <div className="text-xs text-gray-500">
                              {row.subProgramName}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-gray-900">
                              {row.activityCode}
                            </div>
                            <div className="text-xs text-gray-500 max-w-md truncate">
                              {row.activityName}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pastePreview.length > 20 && (
                    <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 text-center">
                      ... ve {pastePreview.length - 20} satır daha
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasteModal(false);
                  setPasteData('');
                  setPastePreview([]);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              {pastePreview.length === 0 ? (
                <Button
                  onClick={parsePasteData}
                  disabled={!pasteData.trim()}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Önizle
                </Button>
              ) : (
                <Button
                  onClick={handlePasteImport}
                  disabled={importing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? 'Aktarılıyor...' : 'Aktar'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            modalType === 'program'
              ? editingProgram
                ? 'Program Düzenle'
                : 'Yeni Program Ekle'
              : editingSubProgram
              ? 'Alt Program Düzenle'
              : 'Yeni Alt Program Ekle'
          }
        >
          <div className="space-y-4">
            {modalType === 'subprogram' && selectedProgramForSub && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Program:</strong> {selectedProgramForSub.code} - {selectedProgramForSub.name}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kod <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={modalType === 'program' ? 'Örn: 01, 02, 03' : 'Örn: 01, 02'}
              />
              {modalType === 'subprogram' && selectedProgramForSub && (
                <p className="text-xs text-gray-500 mt-1">
                  Tam kod: {selectedProgramForSub.code}.{formData.code || '??'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İsim <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Program/Alt Program adı"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Detaylı açıklama..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Aktif
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
