import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Upload, FileSpreadsheet } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface Program {
  id: string;
  code: string;
  name: string;
  sub_programs: SubProgram[];
}

interface SubProgram {
  id: string;
  code: string;
  name: string;
  activities: Activity[];
}

interface Activity {
  id: string;
  code: string;
  name: string;
}

interface EconomicCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
}

export default function BudgetPerformanceCodes() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<EconomicCode[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<EconomicCode[]>([]);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'expense' | 'revenue'>('expense');
  const [importData, setImportData] = useState('');

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      const { data: programsData } = await supabase
        .from('programs')
        .select('id, code, name')
        .eq('organization_id', profile.organization_id)
        .order('code');

      const programIds = (programsData || []).map(p => p.id);

      const { data: subProgramsData } = await supabase
        .from('sub_programs')
        .select('id, code, name, program_id')
        .in('program_id', programIds)
        .order('code');

      const subProgramIds = (subProgramsData || []).map(sp => sp.id);

      let activitiesData: any[] = [];
      if (subProgramIds.length > 0) {
        const { data: actData } = await supabase
          .from('activities')
          .select('id, code, name, sub_program_id')
          .in('sub_program_id', subProgramIds)
          .order('code');
        activitiesData = actData || [];
      }

      // Sort numerically by code
      const sortByCode = (a: any, b: any) => {
        const aNum = parseInt(a.code.split('-')[0]);
        const bNum = parseInt(b.code.split('-')[0]);
        return aNum - bNum;
      };

      programsData?.sort(sortByCode);
      subProgramsData?.sort(sortByCode);
      activitiesData?.sort(sortByCode);

      const hierarchy = (programsData || []).map(program => ({
        ...program,
        sub_programs: (subProgramsData || [])
          .filter(sp => sp.program_id === program.id)
          .map(subProgram => ({
            ...subProgram,
            activities: activitiesData.filter(a => a.sub_program_id === subProgram.id)
          }))
      }));

      setPrograms(hierarchy);

      const { data: expenseData } = await supabase
        .from('expense_economic_codes')
        .select('id, code, name, full_code')
        .eq('organization_id', profile.organization_id)
        .eq('level', 4)
        .order('full_code');

      const { data: revenueData } = await supabase
        .from('revenue_economic_codes')
        .select('id, code, name, full_code')
        .eq('organization_id', profile.organization_id)
        .eq('level', 4)
        .order('full_code');

      setExpenseCodes(expenseData || []);
      setRevenueCodes(revenueData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

const toggleProgram = (id: string) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

const handleBulkImport = async () => {
    if (!profile?.organization_id || !importData.trim()) {
      alert('Lütfen veri girin');
      return;
    }

    try {
      const lines = importData.trim().split('\n');
      const table = importType === 'expense' ? 'expense_economic_codes' : 'revenue_economic_codes';

      const level1Codes: any = {};
      const level2Codes: any = {};
      const level3Codes: any = {};
      let successCount = 0;
      let errorCount = 0;

      for (const line of lines) {
        const rawParts = line.split('\t').map(p => p.trim());
        if (rawParts.length < 2) continue;

        const [code1, code2, code3, code4, ...nameParts] = rawParts;
        const name = nameParts.join(' ').trim();

        if (!name) continue;

        try {
          if (code1 && !code2) {
            const { data, error } = await supabase
              .from(table)
              .insert({
                organization_id: profile.organization_id,
                level: 1,
                code: code1,
                name: name,
                full_code: code1,
                parent_id: null,
              })
              .select()
              .single();
            if (error) throw error;
            if (data) level1Codes[code1] = data.id;
            successCount++;
          } else if (code1 && code2 && !code3) {
            const parentId = level1Codes[code1];
            if (!parentId) {
              console.warn(`Parent not found for ${code1}-${code2}`);
              errorCount++;
              continue;
            }

            const { data, error } = await supabase
              .from(table)
              .insert({
                organization_id: profile.organization_id,
                level: 2,
                code: code2,
                name: name,
                full_code: `${code1}-${code2}`,
                parent_id: parentId,
              })
              .select()
              .single();
            if (error) throw error;
            if (data) level2Codes[`${code1}-${code2}`] = data.id;
            successCount++;
          } else if (code1 && code2 && code3 && !code4) {
            const parentId = level2Codes[`${code1}-${code2}`];
            if (!parentId) {
              console.warn(`Parent not found for ${code1}-${code2}-${code3}`);
              errorCount++;
              continue;
            }

            const { data, error } = await supabase
              .from(table)
              .insert({
                organization_id: profile.organization_id,
                level: 3,
                code: code3,
                name: name,
                full_code: `${code1}-${code2}-${code3}`,
                parent_id: parentId,
              })
              .select()
              .single();
            if (error) throw error;
            if (data) level3Codes[`${code1}-${code2}-${code3}`] = data.id;
            successCount++;
          } else if (code1 && code2 && code3 && code4) {
            const parentId = level3Codes[`${code1}-${code2}-${code3}`];
            if (!parentId) {
              console.warn(`Parent not found for ${code1}-${code2}-${code3}-${code4}`);
              errorCount++;
              continue;
            }

            const { error } = await supabase
              .from(table)
              .insert({
                organization_id: profile.organization_id,
                level: 4,
                code: code4,
                name: name,
                full_code: `${code1}-${code2}-${code3}-${code4}`,
                parent_id: parentId,
              });
            if (error) throw error;
            successCount++;
          }
        } catch (err: any) {
          console.error('Import error:', err);
          errorCount++;
        }
      }

      const message = errorCount > 0
        ? `${successCount} kayıt eklendi, ${errorCount} kayıt atlandı`
        : `${successCount} ekonomik kod başarıyla eklendi`;

      alert(message);
      loadData();
      setImportModalOpen(false);
      setImportData('');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  if (loading) return <div className="text-center py-8">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Program - Alt Program - Faaliyet</h3>
          <div className="space-y-2">
            {programs.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                Henüz program tanımlanmamış. Lütfen önce Program Yönetimi sayfasından program ekleyin.
              </p>
            ) : (
              programs.map(program => (
                <div key={program.id} className="border border-slate-200 rounded-lg">
                  <div
                    className="flex items-center gap-2 p-3 bg-slate-50 cursor-pointer"
                    onClick={() => toggleProgram(program.id)}
                  >
                    {expandedPrograms.has(program.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-mono font-semibold text-blue-900">{program.code}</span>
                    <span className="font-medium">{program.name}</span>
                  </div>

                  {expandedPrograms.has(program.id) && (
                    <div className="p-3 space-y-2">
                      {program.sub_programs.map(subProgram => (
                        <div key={subProgram.id} className="ml-4 border-l-2 border-slate-300 pl-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-mono text-green-700">{subProgram.code}</span>
                            <span className="text-slate-700">{subProgram.name}</span>
                          </div>
                          {subProgram.activities.length > 0 && (
                            <div className="ml-4 mt-1 space-y-1">
                              {subProgram.activities.map(activity => (
                                <div key={activity.id} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className="font-mono">{activity.code}</span>
                                  <span>{activity.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Gider Ekonomik Kodları</h3>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setImportType('expense');
                  setImportModalOpen(true);
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                İçe Aktar
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {expenseCodes.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-sm">
                  Henüz gider ekonomik kodu tanımlanmamış
                </p>
              ) : (
                expenseCodes.map(code => (
                  <div key={code.id} className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded">
                    <span className="font-mono text-slate-700">{code.full_code}</span>
                    <span className="text-slate-600">{code.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Gelir Ekonomik Kodları</h3>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setImportType('revenue');
                  setImportModalOpen(true);
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                İçe Aktar
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {revenueCodes.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-sm">
                  Henüz gelir ekonomik kodu tanımlanmamış
                </p>
              ) : (
                revenueCodes.map(code => (
                  <div key={code.id} className="flex items-center gap-2 text-sm p-2 hover:bg-slate-50 rounded">
                    <span className="font-mono text-slate-700">{code.full_code}</span>
                    <span className="text-slate-600">{code.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title={`Excel'den ${importType === 'expense' ? 'Gider' : 'Gelir'} Ekonomik Kod İçe Aktarma`}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Nasıl Kullanılır?</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Excel'deki ekonomik kodları kopyalayın (4 seviye + ad)</li>
              <li>Aşağıdaki alana yapıştırın</li>
              <li>"İçe Aktar" butonuna tıklayın</li>
            </ol>
            <div className="mt-3 text-xs text-blue-700 bg-blue-100 p-2 rounded">
              <strong>Format Kuralları:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Seviye 1:</strong> Kod1 (boş) (boş) (boş) Adı</li>
                <li><strong>Seviye 2:</strong> Kod1 Kod2 (boş) (boş) Adı</li>
                <li><strong>Seviye 3:</strong> Kod1 Kod2 Kod3 (boş) Adı</li>
                <li><strong>Seviye 4:</strong> Kod1 Kod2 Kod3 Kod4 Adı</li>
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
              rows={18}
              placeholder={`Örnek (Tab ile ayrılmış):
01				PERSONEL GİDERLERİ
01	01			MEMURLAR
01	01	01		TEMEL MAAŞLAR
01	01	01	001	Temel Maaş
01	01	01	002	Kıdem Aylığı
01	01	01	003	Ek Gösterge`}
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
