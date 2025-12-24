import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, ChevronDown, ChevronRight, Layers, Upload } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface Activity {
  id: string;
  code: string;
  name: string;
  sub_program_id: string;
}

interface SubProgram {
  id: string;
  code: string;
  name: string;
  program_id: string;
  activities: Activity[];
}

interface Program {
  id: string;
  code: string;
  name: string;
  sub_programs: SubProgram[];
}

export default function BudgetPrograms() {
  const { profile } = useAuth();
  const [hierarchyData, setHierarchyData] = useState<Program[]>([]);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedSubPrograms, setExpandedSubPrograms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'program' | 'subprogram' | 'activity'>('program');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
  });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState('');

  useEffect(() => {
    if (profile?.organization_id) {
      loadHierarchy();
    }
  }, [profile]);

  const loadHierarchy = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      const { data: programsData } = await supabase
        .from('programs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('code');

      const { data: subProgramsData } = await supabase
        .from('sub_programs')
        .select('*')
        .in('program_id', (programsData || []).map(p => p.id))
        .order('code');

      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, code, name, sub_program_id')
        .in('sub_program_id', (subProgramsData || []).map(sp => sp.id))
        .order('code');

      // Sort numerically by code
      const sortByCode = (a: any, b: any) => {
        const aNum = parseInt(a.code.split('-')[0]);
        const bNum = parseInt(b.code.split('-')[0]);
        return aNum - bNum;
      };

      programsData?.sort(sortByCode);
      subProgramsData?.sort(sortByCode);
      activitiesData?.sort(sortByCode);

      const hierarchy: Program[] = (programsData || []).map(program => ({
        ...program,
        sub_programs: (subProgramsData || [])
          .filter(sp => sp.program_id === program.id)
          .map(subProgram => ({
            ...subProgram,
            activities: (activitiesData || [])
              .filter(a => a.sub_program_id === subProgram.id)
              .map(a => ({ ...a, sub_program_id: subProgram.id }))
          }))
      }));

      setHierarchyData(hierarchy);
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProgram = (id: string) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSubProgram = (id: string) => {
    setExpandedSubPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openModal = (type: 'program' | 'subprogram' | 'activity', parent?: string, item?: any) => {
    setModalType(type);
    setParentId(parent || null);

    if (item) {
      setEditingId(item.id);
      setFormData({
        code: item.code,
        name: item.name,
      });
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setParentId(null);
    setFormData({ code: '', name: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      if (modalType === 'program') {
        const data = {
          organization_id: profile.organization_id,
          code: formData.code,
          name: formData.name,
        };

        if (editingId) {
          await supabase.from('programs').update(data).eq('id', editingId);
        } else {
          await supabase.from('programs').insert(data);
        }
      } else if (modalType === 'subprogram' && parentId) {
        const program = hierarchyData.find(p => p.id === parentId);
        const data = {
          organization_id: profile.organization_id,
          program_id: parentId,
          code: formData.code,
          name: formData.name,
          full_code: `${program?.code}-${formData.code}`,
        };

        if (editingId) {
          await supabase.from('sub_programs').update(data).eq('id', editingId);
        } else {
          await supabase.from('sub_programs').insert(data);
        }
      } else if (modalType === 'activity' && parentId) {
        const data = {
          sub_program_id: parentId,
          code: formData.code,
          name: formData.name,
          organization_id: profile.organization_id,
        };

        if (editingId) {
          await supabase.from('activities').update(data).eq('id', editingId);
        } else {
          await supabase.from('activities').insert(data);
        }
      }

      alert('Başarıyla kaydedildi');
      loadHierarchy();
      closeModal();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDelete = async (type: 'program' | 'subprogram' | 'activity', id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return;

    try {
      const table = type === 'program' ? 'programs' : type === 'subprogram' ? 'sub_programs' : 'activities';
      await supabase.from(table).delete().eq('id', id);
      alert('Silindi');
      loadHierarchy();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const validateTableStructure = async () => {
    console.log('🔍 Validating table structure...');

    try {
      const { data: programTest, error: programError } = await supabase
        .from('programs')
        .select('id, code, name, organization_id')
        .limit(1);

      if (programError) {
        console.error('❌ Programs table error:', programError);
        throw new Error(`Programs table: ${programError.message}`);
      }

      const { data: subProgramTest, error: subProgramError } = await supabase
        .from('sub_programs')
        .select('id, code, name, program_id, organization_id')
        .limit(1);

      if (subProgramError) {
        console.error('❌ Sub-programs table error:', subProgramError);
        throw new Error(`Sub-programs table: ${subProgramError.message}`);
      }

      const { data: activityTest, error: activityError } = await supabase
        .from('activities')
        .select('id, code, name, sub_program_id, organization_id')
        .limit(1);

      if (activityError) {
        console.error('❌ Activities table error:', activityError);
        throw new Error(`Activities table: ${activityError.message}`);
      }

      console.log('✅ Table structure validation passed');
      return true;
    } catch (error: any) {
      console.error('❌ Table structure validation failed:', error);
      alert('Tablo yapısı hatası: ' + error.message + '\n\nLütfen sayfayı yenileyip tekrar deneyin.');
      return false;
    }
  };

  const handleBulkImport = async () => {
    if (!profile?.organization_id || !importData.trim()) {
      alert('Lütfen veri girin');
      return;
    }

    const isValid = await validateTableStructure();
    if (!isValid) {
      return;
    }

    try {
      const lines = importData.trim().split('\n');
      const programCodes: any = {};
      const subProgramCodes: any = {};
      let successCount = 0;
      let errorCount = 0;

      const { data: existingPrograms } = await supabase
        .from('programs')
        .select('id, code')
        .eq('organization_id', profile.organization_id);

      if (existingPrograms) {
        existingPrograms.forEach(p => {
          programCodes[p.code] = p.id;
        });
      }

      const { data: existingSubPrograms } = await supabase
        .from('sub_programs')
        .select('id, code, program_id, programs(code)')
        .eq('organization_id', profile.organization_id);

      if (existingSubPrograms) {
        existingSubPrograms.forEach((sp: any) => {
          const programCode = sp.programs?.code;
          if (programCode) {
            subProgramCodes[`${programCode}-${sp.code}`] = sp.id;
          }
        });
      }

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split('\t').map(p => p?.trim() || '');

        const code1 = parts[0] || '';
        const code2 = parts[1] || '';
        const code3 = parts[2] || '';
        const name = parts[3] || '';

        if (!name) {
          console.warn('⚠️ Missing name, skipping:', line);
          errorCount++;
          continue;
        }

        if (code1 && !/^\d+$/.test(code1)) {
          console.warn('⚠️ code1 is not numeric:', code1);
          errorCount++;
          continue;
        }
        if (code2 && !/^\d+$/.test(code2)) {
          console.warn('⚠️ code2 is not numeric:', code2);
          errorCount++;
          continue;
        }
        if (code3 && !/^\d+$/.test(code3)) {
          console.warn('⚠️ code3 is not numeric:', code3);
          errorCount++;
          continue;
        }

        const hasCode1 = code1.length > 0;
        const hasCode2 = code2.length > 0;
        const hasCode3 = code3.length > 0;

        console.log(`✅ Processing: [${code1}][${code2}][${code3}] → ${name} | Level: ${hasCode3 ? 3 : hasCode2 ? 2 : 1}`);

        try {
          if (hasCode1 && !hasCode2 && !hasCode3) {
            if (!programCodes[code1]) {
              console.log(`📝 Creating program: ${code1} - ${name}`);
              const { data, error } = await supabase
                .from('programs')
                .insert({
                  organization_id: profile.organization_id,
                  code: code1,
                  name: name,
                })
                .select()
                .single();
              if (error) throw error;
              if (data) {
                programCodes[code1] = data.id;
                successCount++;
                console.log(`✅ Program created: ${code1}`);
              }
            } else {
              console.log(`⏭️ Program ${code1} already exists, skipping`);
            }
          } else if (hasCode1 && hasCode2 && !hasCode3) {
            if (!code2) {
              console.warn('⚠️ code2 is empty for sub-program, skipping');
              errorCount++;
              continue;
            }

            const programId = programCodes[code1];
            if (!programId) {
              console.warn(`❌ Program not found for code: ${code1} (needed for sub-program ${code1}-${code2})`);
              errorCount++;
              continue;
            }

            const key = `${code1}-${code2}`;
            if (!subProgramCodes[key]) {
              const fullCode = `${code1}-${code2}`;
              console.log(`📝 Creating sub-program: ${key} - ${name} (full_code: ${fullCode})`);
              const { data, error } = await supabase
                .from('sub_programs')
                .insert({
                  organization_id: profile.organization_id,
                  program_id: programId,
                  code: code2,
                  name: name,
                  full_code: fullCode,
                })
                .select()
                .single();
              if (error) throw error;
              if (data) {
                subProgramCodes[key] = data.id;
                successCount++;
                console.log(`✅ Sub-program created: ${key}`);
              }
            } else {
              console.log(`⏭️ Sub-program ${key} already exists, skipping`);
            }
          } else if (hasCode1 && hasCode2 && hasCode3) {
            if (!code3) {
              console.warn('⚠️ code3 is empty for activity, skipping');
              errorCount++;
              continue;
            }

            const key = `${code1}-${code2}`;
            const subProgramId = subProgramCodes[key];
            if (!subProgramId) {
              console.warn(`❌ Sub-program not found for code: ${key} (needed for activity ${code1}-${code2}-${code3})`);
              errorCount++;
              continue;
            }

            console.log(`📝 Creating activity: ${code1}-${code2}-${code3} - ${name}`);
            const { error } = await supabase
              .from('activities')
              .insert({
                organization_id: profile.organization_id,
                sub_program_id: subProgramId,
                code: code3,
                name: name,
              });
            if (error) throw error;
            successCount++;
            console.log(`✅ Activity created: ${code1}-${code2}-${code3}`);
          } else {
            console.warn(`⚠️ Invalid code combination: [${code1}][${code2}][${code3}]`);
            errorCount++;
          }
        } catch (err: any) {
          console.error('❌ Import error:', err.message, 'for line:', line);
          errorCount++;
        }
      }

      const message = errorCount > 0
        ? `${successCount} kayıt eklendi, ${errorCount} kayıt atlandı`
        : `${successCount} kayıt başarıyla eklendi`;

      alert(message);
      loadHierarchy();
      setImportModalOpen(false);
      setImportData('');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Program - Alt Program - Faaliyet Yönetimi</h1>
          <p className="text-slate-600 mt-1">Hiyerarşik program yapısını yönetin</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Excel'den İçe Aktar
          </Button>
          <Button onClick={() => openModal('program')}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Program
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 w-32">Program</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 w-1/3">Alt Program</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Faaliyet</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900 w-32">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {hierarchyData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz program tanımlanmamış</p>
                  </td>
                </tr>
              ) : (
                hierarchyData.map((program) => (
                  <>
                    <tr key={program.id} className="bg-blue-50 hover:bg-blue-100 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleProgram(program.id)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            {expandedPrograms.has(program.id) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                          <span className="font-mono font-bold text-blue-900">{program.code}</span>
                          <span className="font-semibold text-slate-900">{program.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">-</td>
                      <td className="px-6 py-4 text-slate-500">-</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openModal('subprogram', program.id)}>
                            <Plus className="w-3 h-3 mr-1" />
                            Alt Program
                          </Button>
                          <button
                            onClick={() => openModal('program', undefined, program)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('program', program.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedPrograms.has(program.id) && program.sub_programs.map((subProgram) => (
                      <>
                        <tr key={subProgram.id} className="bg-green-50 hover:bg-green-100 transition-colors">
                          <td className="px-6 py-3"></td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleSubProgram(subProgram.id)}
                                className="text-slate-600 hover:text-slate-900"
                              >
                                {expandedSubPrograms.has(subProgram.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              <span className="font-mono font-semibold text-green-900">{subProgram.code}</span>
                              <span className="font-medium text-slate-900">{subProgram.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-slate-500">-</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openModal('activity', subProgram.id)}>
                                <Plus className="w-3 h-3 mr-1" />
                                Faaliyet
                              </Button>
                              <button
                                onClick={() => openModal('subprogram', program.id, subProgram)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete('subprogram', subProgram.id)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedSubPrograms.has(subProgram.id) && subProgram.activities.map((activity) => (
                          <tr key={activity.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-2"></td>
                            <td className="px-6 py-2"></td>
                            <td className="px-6 py-2">
                              <div className="flex items-center gap-2 pl-8">
                                <span className="font-mono text-sm text-slate-600">{activity.code}</span>
                                <span className="text-slate-900">{activity.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openModal('activity', subProgram.id, activity)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDelete('activity', activity.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={
          editingId
            ? `${modalType === 'program' ? 'Program' : modalType === 'subprogram' ? 'Alt Program' : 'Faaliyet'} Düzenle`
            : `Yeni ${modalType === 'program' ? 'Program' : modalType === 'subprogram' ? 'Alt Program' : 'Faaliyet'}`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kod *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
              placeholder="Örn: 16, 48, 940"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ad *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              İptal
            </Button>
            <Button type="submit">{editingId ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Excel'den Program İçe Aktarma"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Nasıl Kullanılır?</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Excel'deki program yapısını kopyalayın (3 seviye + ad)</li>
              <li>Aşağıdaki alana yapıştırın</li>
              <li>"İçe Aktar" butonuna tıklayın</li>
            </ol>
            <div className="mt-3 text-xs text-blue-700 bg-blue-100 p-2 rounded">
              <strong>ÖNEMLİ - Format Kuralları:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Excel'de <strong>4 KOLON</strong> olmalı (Kod1, Kod2, Kod3, Ad)</li>
                <li><strong>Program:</strong> Sadece Kod1 dolu, diğerleri boş → Kod1 [TAB] [TAB] [TAB] Program Adı</li>
                <li><strong>Alt Program:</strong> Kod1 ve Kod2 dolu → Kod1 [TAB] Kod2 [TAB] [TAB] Alt Program Adı</li>
                <li><strong>Faaliyet:</strong> Hepsi dolu → Kod1 [TAB] Kod2 [TAB] Kod3 [TAB] Faaliyet Adı</li>
                <li>Boş kolonlar da TAB ile ayrılmalı!</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Excel Verilerini Buraya Yapıştırın
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
              rows={15}
              placeholder={`Örnek (Tab ile ayrılmış):
01			Genel Kamu Hizmetleri
01	01		Yasama ve Yürütme Organları
01	01	01	Yasama Faaliyetleri
01	01	02	Yürütme ve İdari İşlerin Yürütülmesi
01	02		Mali ve Maliye Hizmetleri
01	02	01	Genel Ekonomik ve Ticari İşler`}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setImportModalOpen(false)}
            >
              İptal
            </Button>
            <Button onClick={handleBulkImport}>
              <Upload className="w-4 h-4 mr-2" />
              İçe Aktar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
