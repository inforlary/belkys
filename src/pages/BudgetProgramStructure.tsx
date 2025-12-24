import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Plus, Edit2, Trash2, DollarSign, Save, X, Search, Upload, FileText } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  fiscal_year: number;
  status: string;
}

interface Program {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface SubProgram {
  id: string;
  program_id: string;
  code: string;
  name: string;
  full_code: string;
  description: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Activity {
  id: string;
  name: string;
  description: string;
  program_id: string;
  sub_program_id: string;
  department_id?: string;
  program?: Program;
  sub_program?: SubProgram;
  department?: Department;
  expense_count?: number;
}

export default function BudgetProgramStructure() {
  const { user, profile } = useAuth();
  const { navigate } = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');

  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [subProgramActivities, setSubProgramActivities] = useState<Activity[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const [formData, setFormData] = useState({
    program_id: '',
    sub_program_id: '',
    activity_id: '',
    department_id: '',
    name: '',
    description: ''
  });

  const [isNewActivity, setIsNewActivity] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  useEffect(() => {
    if (user && profile) {
      loadCampaigns();
      loadPrograms();
      loadDepartments();
    }
  }, [user, profile]);

  useEffect(() => {
    if (selectedCampaign) {
      loadActivities();
    }
  }, [selectedCampaign]);

  useEffect(() => {
    if (formData.program_id) {
      loadSubPrograms(formData.program_id);
    } else {
      setSubPrograms([]);
    }
  }, [formData.program_id]);

  useEffect(() => {
    if (formData.sub_program_id) {
      loadSubProgramActivities(formData.sub_program_id);
    } else {
      setSubProgramActivities([]);
    }
  }, [formData.sub_program_id]);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_proposal_campaigns')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('fiscal_year', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);

      if (data && data.length > 0) {
        const activeCampaign = data.find(c => c.status === 'active') || data[0];
        setSelectedCampaign(activeCampaign.id);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadSubPrograms = async (programId: string) => {
    try {
      const { data, error } = await supabase
        .from('sub_programs')
        .select('*')
        .eq('program_id', programId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setSubPrograms(data || []);
    } catch (error) {
      console.error('Error loading sub programs:', error);
    }
  };

  const loadSubProgramActivities = async (subProgramId: string) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id, name, description')
        .eq('sub_program_id', subProgramId)
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setSubProgramActivities(data || []);
    } catch (error) {
      console.error('Error loading sub program activities:', error);
      setSubProgramActivities([]);
    }
  };

  const loadActivities = async () => {
    try {
      setLoading(true);

      const { data: activitiesData, error } = await supabase
        .from('activities')
        .select(`
          *,
          program:programs(id, code, name),
          sub_program:sub_programs(id, code, name, full_code),
          department:departments(id, code, name)
        `)
        .eq('organization_id', profile?.organization_id)
        .not('program_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activitiesWithCounts = await Promise.all(
        (activitiesData || []).map(async (activity) => {
          const { count } = await supabase
            .from('expense_budget_entries')
            .select('*', { count: 'exact', head: true })
            .eq('activity_id', activity.id);

          return {
            ...activity,
            expense_count: count || 0
          };
        })
      );

      setActivities(activitiesWithCounts);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    if (!selectedCampaign) {
      alert('Lütfen önce bir bütçe kampanyası seçin.');
      return;
    }

    setEditingActivity(null);
    setFormData({
      program_id: '',
      sub_program_id: '',
      activity_id: '',
      department_id: profile?.role === 'admin' ? '' : (profile?.department_id || ''),
      name: '',
      description: ''
    });
    setIsNewActivity(false);
    setShowActivityModal(true);
  };

  const openEditModal = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      program_id: activity.program_id,
      sub_program_id: activity.sub_program_id,
      activity_id: activity.id,
      department_id: activity.department_id || '',
      name: activity.name,
      description: activity.description || ''
    });
    setIsNewActivity(false);
    setShowActivityModal(true);
  };

  const handleSaveActivity = async () => {
    if (!formData.program_id || !formData.sub_program_id) {
      alert('Lütfen program ve alt program seçin.');
      return;
    }

    if (profile?.role === 'admin' && !formData.department_id) {
      alert('Lütfen müdürlük seçin.');
      return;
    }

    if (isNewActivity && !formData.name.trim()) {
      alert('Lütfen faaliyet adını girin.');
      return;
    }

    if (!isNewActivity && !formData.activity_id) {
      alert('Lütfen bir faaliyet seçin veya "Yeni Faaliyet Ekle" seçeneğini seçin.');
      return;
    }

    if (!isNewActivity && formData.activity_id) {
      console.log('=== EXISTING ACTIVITY SELECTED ===');
      console.log('Activity ID:', formData.activity_id);
      console.log('Campaign ID:', selectedCampaign);
      console.log('About to call handleManageExpenses...');
      setShowActivityModal(false);
      setTimeout(() => {
        console.log('Calling handleManageExpenses NOW');
        handleManageExpenses(formData.activity_id);
      }, 100);
      return;
    }

    try {
      setSaving(true);

      const activityData = {
        organization_id: profile?.organization_id,
        department_id: formData.department_id || profile?.department_id,
        program_id: formData.program_id,
        sub_program_id: formData.sub_program_id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: 'active',
        progress: 0
      };

      let savedActivityId: string | null = null;

      if (editingActivity) {
        const { error } = await supabase
          .from('activities')
          .update(activityData)
          .eq('id', editingActivity.id);

        if (error) throw error;
        savedActivityId = editingActivity.id;
      } else {
        const { data, error } = await supabase
          .from('activities')
          .insert(activityData)
          .select()
          .single();

        if (error) throw error;
        savedActivityId = data.id;
      }

      console.log('=== NEW ACTIVITY CREATED ===');
      console.log('New Activity ID:', savedActivityId);
      console.log('Campaign ID:', selectedCampaign);
      setShowActivityModal(false);
      loadActivities();

      if (savedActivityId) {
        setTimeout(() => {
          console.log('Calling handleManageExpenses for new activity NOW');
          handleManageExpenses(savedActivityId);
        }, 100);
      }
    } catch (error: any) {
      console.error('Error saving activity:', error);
      alert('Faaliyet kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = async (activityId: string, hasExpenses: boolean) => {
    if (hasExpenses) {
      alert('Bu faaliyetin gider kalemleri bulunmaktadır. Önce giderleri silmelisiniz.');
      return;
    }

    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;

      loadActivities();
    } catch (error: any) {
      console.error('Error deleting activity:', error);
      alert('Faaliyet silinirken hata oluştu: ' + error.message);
    }
  };

  const handleManageExpenses = (activityId: string) => {
    console.log('=== handleManageExpenses CALLED ===');
    console.log('activityId:', activityId);
    console.log('selectedCampaign:', selectedCampaign);

    if (!selectedCampaign) {
      console.error('NO CAMPAIGN SELECTED!');
      alert('Lütfen önce bir bütçe kampanyası seçin.');
      return;
    }

    const targetUrl = `budget-expense-items?activity=${activityId}&campaign=${selectedCampaign}`;
    console.log('Target URL:', targetUrl);
    console.log('Current hash BEFORE:', window.location.hash);

    window.location.hash = targetUrl;

    console.log('Hash set directly!');
    console.log('Current hash AFTER:', window.location.hash);
  };

  const handleExportToExcel = async () => {
    try {
      const { data: allPrograms } = await supabase
        .from('programs')
        .select('*')
        .eq('organization_id', profile?.organization_id)
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
      link.download = `program-yapisi-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Program yapısı başarıyla export edildi.');
    } catch (error: any) {
      console.error('Export hatası:', error);
      alert('Export sırasında hata oluştu: ' + error.message);
    }
  };

  const parseImportData = () => {
    if (!importData.trim()) {
      alert('Lütfen Excel verisi yapıştırın.');
      return;
    }

    const lines = importData.trim().split('\n');
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

    setImportPreview(parsed);
  };

  const handleImport = async () => {
    if (importPreview.length === 0) {
      alert('Lütfen önce veriyi önizleyin.');
      return;
    }

    if (!confirm(`${importPreview.length} satır import edilecek. Devam etmek istiyor musunuz?`)) {
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

      for (const row of importPreview) {
        const { programCode, subProgramCode, activityCode, programName, subProgramName, activityName } = row;

        console.log('Processing row:', { programCode, subProgramCode, activityCode, programName, subProgramName, activityName });

        let programId = programsMap.get(programCode);

        if (!programId) {
          const { data: existingProgram } = await supabase
            .from('programs')
            .select('id')
            .eq('organization_id', profile?.organization_id)
            .eq('code', programCode)
            .maybeSingle();

          if (existingProgram) {
            programId = existingProgram.id;
          } else {
            const { data: newProgram, error: programError } = await supabase
              .from('programs')
              .insert({
                organization_id: profile?.organization_id,
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
                  organization_id: profile?.organization_id,
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

      setShowImportModal(false);
      setImportData('');
      setImportPreview([]);
      loadPrograms();
    } catch (error: any) {
      console.error('Import hatası:', error);
      alert('Import sırasında hata oluştu: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch =
      activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProgram = !filterProgram || activity.program_id === filterProgram;

    return matchesSearch && matchesProgram;
  });

  if (!profile) {
    return <div className="p-6">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Program Yapısı ve Faaliyetlerim</h1>
            <p className="mt-1 text-sm text-gray-600">
              Bütçe teklifiniz için önce program yapınızı ve faaliyetlerinizi tanımlayın
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Upload className="h-5 w-5 mr-2" />
              Excel'den Aktar
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Faaliyet Ekle / Gider Gir
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bütçe Kampanyası
          </label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Kampanya Seçin</option>
            {campaigns.map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.fiscal_year})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Faaliyet ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Tüm Programlar</option>
              {programs.map(program => (
                <option key={program.id} value={program.id}>
                  {program.code} - {program.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Yükleniyor...</div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-4">Henüz faaliyet eklenmemiş</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Faaliyet Ekle / Gider Gir
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {profile?.role === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Müdürlük
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Alt Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Faaliyet
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Gider Sayısı
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredActivities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    {profile?.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {activity.department?.code}
                        </div>
                        <div className="text-sm text-gray-500">
                          {activity.department?.name}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {activity.program?.code}
                      </div>
                      <div className="text-sm text-gray-500">
                        {activity.program?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {activity.sub_program?.full_code}
                      </div>
                      <div className="text-sm text-gray-500">
                        {activity.sub_program?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {activity.name}
                      </div>
                      {activity.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {activity.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        (activity.expense_count || 0) > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.expense_count || 0} Kalem
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleManageExpenses(activity.id);
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                        title="Gider Kalemlerini Yönet"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Giderler
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEditModal(activity);
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="Düzenle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteActivity(activity.id, (activity.expense_count || 0) > 0);
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Program Yapısı Excel'den Aktar</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Excel'den program, alt program ve faaliyet verilerini kopyalayıp yapıştırın
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportPreview([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

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
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                    rows={10}
                    placeholder="Excel'den veriyi buraya yapıştırın..."
                  />
                </div>

                {importPreview.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b">
                      <h3 className="font-medium text-gray-900">
                        Önizleme ({importPreview.length} satır)
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
                          {importPreview.slice(0, 20).map((row, idx) => (
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
                      {importPreview.length > 20 && (
                        <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 text-center">
                          ... ve {importPreview.length - 20} satır daha
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportPreview([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                {importPreview.length === 0 ? (
                  <button
                    onClick={parseImportData}
                    disabled={!importData.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <FileText className="h-5 w-5 inline mr-2" />
                    Önizle
                  </button>
                ) : (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5 inline mr-2" />
                    {importing ? 'Aktarılıyor...' : 'Aktar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingActivity ? 'Faaliyet Düzenle' : 'Faaliyet Seç veya Yeni Ekle'}
                </h2>
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {profile?.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Müdürlük *
                    </label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Müdürlük Seçin</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.code} - {dept.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      Yönetici olarak herhangi bir müdürlük için bütçe oluşturabilirsiniz
                    </p>
                  </div>
                )}

                {profile?.role !== 'admin' && profile?.department_id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <span className="font-medium">Müdürlük:</span>{' '}
                      {departments.find(d => d.id === profile.department_id)?.name || 'Müdürlüğünüz'}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Kendi müdürlüğünüz için bütçe oluşturabilirsiniz
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program *
                  </label>
                  <select
                    value={formData.program_id}
                    onChange={(e) => setFormData({ ...formData, program_id: e.target.value, sub_program_id: '' })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Program Seçin</option>
                    {programs.map(program => (
                      <option key={program.id} value={program.id}>
                        {program.code} - {program.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alt Program *
                  </label>
                  <select
                    value={formData.sub_program_id}
                    onChange={(e) => setFormData({ ...formData, sub_program_id: e.target.value, activity_id: '' })}
                    className="w-full border rounded-lg px-3 py-2"
                    disabled={!formData.program_id}
                    required
                  >
                    <option value="">Alt Program Seçin</option>
                    {subPrograms.map(subProgram => (
                      <option key={subProgram.id} value={subProgram.id}>
                        {subProgram.full_code} - {subProgram.name}
                      </option>
                    ))}
                  </select>
                  {!formData.program_id && (
                    <p className="mt-1 text-sm text-gray-500">Önce program seçin</p>
                  )}
                </div>

                {formData.sub_program_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Faaliyet *
                    </label>
                    <select
                      value={formData.activity_id}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'NEW') {
                          setIsNewActivity(true);
                          setFormData({ ...formData, activity_id: '', name: '', description: '' });
                        } else {
                          setIsNewActivity(false);
                          const selectedActivity = subProgramActivities.find(a => a.id === value);
                          setFormData({
                            ...formData,
                            activity_id: value,
                            name: selectedActivity?.name || '',
                            description: selectedActivity?.description || ''
                          });
                        }
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Faaliyet Seçin</option>
                      {subProgramActivities.length > 0 && (
                        <optgroup label="Bu alt programa ait mevcut faaliyetler:">
                          {subProgramActivities.map((activity) => (
                            <option key={activity.id} value={activity.id}>
                              {activity.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Yeni">
                        <option value="NEW">+ Yeni Faaliyet Ekle</option>
                      </optgroup>
                    </select>
                  </div>
                )}

                {isNewActivity && formData.sub_program_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Faaliyet Adı *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Örn: Okul Yapımı, Aşı Kampanyası"
                      required
                    />
                  </div>
                )}

                {isNewActivity && formData.sub_program_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Açıklama
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      rows={4}
                      placeholder="Faaliyet hakkında detaylı bilgi..."
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowActivityModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveActivity();
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-5 w-5 inline mr-2" />
                  {saving
                    ? 'İşleniyor...'
                    : isNewActivity
                      ? 'Kaydet'
                      : 'Devam Et'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
