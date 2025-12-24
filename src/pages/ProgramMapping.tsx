import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Search, X, Trash2, Info, Edit2, Filter } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Program {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface SubProgram {
  id: string;
  program_id: string;
  code: string;
  name: string;
  full_code: string;
  is_active: boolean;
}

interface Activity {
  id: string;
  sub_program_id: string;
  activity_code: string;
  activity_name: string;
  is_active: boolean;
}

interface Indicator {
  id: string;
  name: string;
  code: string;
  goal_id: string;
  goals: {
    title: string;
    code: string;
  };
}

interface Mapping {
  id: string;
  organization_id: string;
  department_id: string;
  program_id: string;
  sub_program_id: string;
  activity_id: string;
  indicator_id: string | null;
  is_active: boolean;
  created_at: string;
  departments: {
    name: string;
    code: string;
  };
  programs: {
    code: string;
    name: string;
  };
  sub_programs: {
    code: string;
    full_code: string;
  };
  sub_program_activities: {
    activity_code: string;
    activity_name: string;
  };
  indicators?: {
    name: string;
    code: string;
  };
}

export default function ProgramMapping() {
  const { user, profile } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedSubProgramId, setSelectedSubProgramId] = useState('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedIndicatorIds, setSelectedIndicatorIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);

useEffect(() => {
    if (profile?.organization_id) {
      loadDepartments();
      loadPrograms();
      loadMappings();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedProgramId) {
      loadSubPrograms(selectedProgramId);
    } else {
      setSubPrograms([]);
      setSelectedSubProgramId('');
    }
  }, [selectedProgramId]);

useEffect(() => {
    if (selectedSubProgramId) {
      loadActivities(selectedSubProgramId);
    } else {
      setActivities([]);
      setSelectedActivityIds([]);
    }
  }, [selectedSubProgramId]);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadDepartmentIndicators(selectedDepartmentId);
    } else {
      setIndicators([]);
    }
  }, [selectedDepartmentId]);

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

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('is_active', true)
        .is('organization_id', null)
        .order('code');

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const loadSubPrograms = async (programId: string) => {
    try {
      const { data, error } = await supabase
        .from('sub_programs')
        .select('*')
        .eq('program_id', programId)
        .eq('is_active', true)
        .is('organization_id', null)
        .order('code');

      if (error) throw error;
      setSubPrograms(data || []);
    } catch (error) {
      console.error('Error loading sub programs:', error);
    }
  };

  const loadActivities = async (subProgramId: string) => {
    try {
      const { data, error } = await supabase
        .from('sub_program_activities')
        .select('*')
        .eq('sub_program_id', subProgramId)
        .eq('is_active', true)
        .order('activity_code');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const loadDepartmentIndicators = async (departmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('indicators')
        .select(`
          id,
          name,
          code,
          goal_id,
          goals!inner (
            id,
            title,
            code,
            department_id
          )
        `)
        .eq('goals.department_id', departmentId)
        .eq('organization_id', profile?.organization_id);

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Error loading indicators:', error);
    }
  };

  const loadMappings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('program_activity_indicator_mappings')
        .select(`
          *,
          departments (name, code),
          programs (code, name),
          sub_programs (code, full_code),
          sub_program_activities (activity_code, activity_name),
          indicators (name, code)
        `)
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMappings(data || []);
    } catch (error) {
      console.error('Error loading mappings:', error);
    } finally {
      setLoading(false);
    }
  };

const getUsedIndicatorIds = () => {
    return new Set(
      mappings
        .filter(m => m.indicator_id && m.id !== editingMappingId)
        .map(m => m.indicator_id as string)
    );
  };

  const getAvailableIndicators = () => {
    const usedIds = getUsedIndicatorIds();
    return indicators.filter(ind => !usedIds.has(ind.id));
  };

const handleSave = async () => {
    if (!selectedDepartmentId || !selectedProgramId || !selectedSubProgramId || selectedActivityIds.length === 0) {
      alert('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    setSaving(true);
    try {
      if (editingMappingId) {
        const indicatorId = selectedIndicatorIds.length > 0 ? selectedIndicatorIds[0] : null;
        const { error } = await supabase
          .from('program_activity_indicator_mappings')
          .update({
            department_id: selectedDepartmentId,
            program_id: selectedProgramId,
            sub_program_id: selectedSubProgramId,
            activity_id: selectedActivityIds[0],
            indicator_id: indicatorId,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingMappingId);

        if (error) throw error;
        alert('Eşleştirme başarıyla güncellendi');
      } else {
        const mappingsToInsert = [];

        for (const activityId of selectedActivityIds) {
          if (selectedIndicatorIds.length === 0) {
            mappingsToInsert.push({
              organization_id: profile?.organization_id,
              department_id: selectedDepartmentId,
              program_id: selectedProgramId,
              sub_program_id: selectedSubProgramId,
              activity_id: activityId,
              indicator_id: null,
              created_by: user?.id
            });
          } else {
            for (const indicatorId of selectedIndicatorIds) {
              mappingsToInsert.push({
                organization_id: profile?.organization_id,
                department_id: selectedDepartmentId,
                program_id: selectedProgramId,
                sub_program_id: selectedSubProgramId,
                activity_id: activityId,
                indicator_id: indicatorId,
                created_by: user?.id
              });
            }
          }
        }

        const { error } = await supabase
          .from('program_activity_indicator_mappings')
          .insert(mappingsToInsert);

        if (error) throw error;
        alert(`${mappingsToInsert.length} eşleştirme başarıyla kaydedildi`);
      }

      handleClear();
      loadMappings();
    } catch (error: any) {
      console.error('Error saving mapping:', error);
      if (error.message?.includes('unique_indicator_usage')) {
        alert('Seçtiğiniz göstergelerden biri zaten başka bir programa atanmış');
      } else {
        alert('Kayıt sırasında bir hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  };

const handleClear = () => {
    setSelectedDepartmentId('');
    setSelectedProgramId('');
    setSelectedSubProgramId('');
    setSelectedActivityIds([]);
    setSelectedIndicatorIds([]);
    setSubPrograms([]);
    setActivities([]);
    setIndicators([]);
    setEditingMappingId(null);
  };

const handleEdit = async (mapping: Mapping) => {
    setEditingMappingId(mapping.id);
    setSelectedDepartmentId(mapping.department_id);
    setSelectedProgramId(mapping.program_id);
    setSelectedSubProgramId(mapping.sub_program_id);
    setSelectedActivityIds([mapping.activity_id]);
    setSelectedIndicatorIds(mapping.indicator_id ? [mapping.indicator_id] : []);

    await loadSubPrograms(mapping.program_id);
    await loadActivities(mapping.sub_program_id);
    await loadDepartmentIndicators(mapping.department_id);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (mappingId: string) => {
    if (!confirm('Bu eşleştirmeyi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('program_activity_indicator_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      alert('Eşleştirme başarıyla silindi');
      loadMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Silme işlemi başarısız oldu');
    }
  };

const filteredMappings = mappings.filter(m => {
    if (filterDepartmentId && m.department_id !== filterDepartmentId) {
      return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.departments?.name.toLowerCase().includes(term) ||
      m.programs?.name.toLowerCase().includes(term) ||
      m.sub_program_activities?.activity_name.toLowerCase().includes(term) ||
      m.indicators?.name.toLowerCase().includes(term)
    );
  });

  const groupedMappings = filteredMappings.reduce((acc, mapping) => {
    const deptKey = mapping.department_id;
    const deptName = mapping.departments?.name || 'Bilinmeyen Birim';

    if (!acc[deptKey]) {
      acc[deptKey] = {
        departmentName: deptName,
        mappings: []
      };
    }

    acc[deptKey].mappings.push(mapping);
    return acc;
  }, {} as Record<string, { departmentName: string; mappings: Mapping[] }>);

  const availableIndicators = getAvailableIndicators();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Performans Program Faaliyet Eşleştirme</h1>
        <p className="text-gray-600 mt-1">Birim programlarını stratejik plan göstergeleriyle eşleştirin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {editingMappingId && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit2 className="w-5 h-5 text-amber-600" />
                <div className="text-sm font-medium text-amber-900">
                  Düzenleme Modu: Mevcut eşleştirmeyi güncelliyorsunuz
                </div>
              </div>
              <button
                onClick={handleClear}
                className="text-amber-600 hover:text-amber-800 text-sm font-medium"
              >
                İptal Et
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              Performans Programında girilen Program Alt Faaliyet verilerinin Stratejik Plandaki göstergelerin eşleştirilmesi gerekmektedir.
              Bu eşleştirme yapılmadan bütçe girişleri yapılamayacak alt faaliyetler sınıflandırılamayacak bir unsuru değildir.
              Faaliyetlerin detaylandırılması için oluşturulan alt faaliyetler.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Birim:</label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Birim Seçiniz</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} - {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Program:</label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              disabled={!selectedDepartmentId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Program Seçiniz</option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.code} - {prog.name}
                </option>
              ))}
            </select>
          </div>
        </div>

<div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Alt Program:</label>
          <select
            value={selectedSubProgramId}
            onChange={(e) => setSelectedSubProgramId(e.target.value)}
            disabled={!selectedProgramId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          >
            <option value="">Alt Program Seçiniz</option>
            {subPrograms.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.full_code} - {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Üst Faaliyetler (Çoklu Seçim):
          </label>
            {!selectedSubProgramId ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-100 text-center text-gray-500 text-sm">
                Önce alt program seçiniz
              </div>
            ) : activities.length === 0 ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 text-center text-gray-500 text-sm">
                Bu alt program için faaliyet bulunamadı
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                {activities.map((act) => (
                  <label key={act.id} className="flex items-center py-2 hover:bg-white px-2 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedActivityIds.includes(act.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedActivityIds([...selectedActivityIds, act.id]);
                        } else {
                          setSelectedActivityIds(selectedActivityIds.filter(id => id !== act.id));
                        }
                      }}
                      className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {act.activity_code} - {act.activity_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          {selectedActivityIds.length > 0 && (
            <div className="mt-2 text-sm text-green-700">
              {selectedActivityIds.length} faaliyet seçildi
            </div>
          )}
        </div>

{selectedActivityIds.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Göstergeler (Opsiyonel - Seçilen Birime Ait):
            </label>
            {availableIndicators.length === 0 ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 text-center text-gray-500 text-sm">
                <Info className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                Bu birim için kullanılabilir gösterge bulunmuyor. Gösterge olmadan da kaydedebilirsiniz.
              </div>
            ) : (
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
              {availableIndicators.map((indicator) => (
                <label key={indicator.id} className="flex items-center py-2 hover:bg-white px-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIndicatorIds.includes(indicator.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIndicatorIds([...selectedIndicatorIds, indicator.id]);
                      } else {
                        setSelectedIndicatorIds(selectedIndicatorIds.filter(id => id !== indicator.id));
                      }
                    }}
                    className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {indicator.code} - {indicator.name}
                    <span className="text-gray-500 text-xs ml-2">({indicator.goals?.code} - {indicator.goals?.title})</span>
                  </span>
                </label>
              ))}
            </div>
            )}
            {selectedIndicatorIds.length > 0 && (
              <div className="mt-2 text-sm text-green-700">
                {selectedIndicatorIds.length} gösterge seçildi
              </div>
            )}
          </div>
        )}

<div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || selectedActivityIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? (editingMappingId ? 'Güncelleniyor...' : 'Kaydediliyor...') : (editingMappingId ? 'Güncelle' : 'Kaydet')}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
            {editingMappingId ? 'İptal' : 'Temizle'}
          </button>
        </div>
      </div>

<div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Mevcut Eşleştirmeler</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Müdürlük Filtresi:</label>
            <select
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Müdürlükler</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} - {dept.name}
                </option>
              ))}
            </select>
            {filterDepartmentId && (
              <button
                onClick={() => setFilterDepartmentId('')}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Yükleniyor...
          </div>
        ) : filteredMappings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Henüz eşleştirme yapılmamış
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedMappings).map(([deptId, group]) => (
              <div key={deptId} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900 uppercase">
                    {group.departmentName}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {group.mappings.length} program
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Program
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Alt Program
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Faaliyet
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Gösterge
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          İşlemler
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {group.mappings.map((mapping) => (
                        <tr key={mapping.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm">
                            <div className="text-gray-900 font-medium">{mapping.programs?.code}</div>
                            <div className="text-gray-600 text-xs">{mapping.programs?.name}</div>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            <div className="text-gray-900 font-medium">{mapping.sub_programs?.full_code}</div>
                            <div className="text-gray-600 text-xs">{mapping.sub_programs?.code}</div>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            <div className="text-gray-900 font-medium">{mapping.sub_program_activities?.activity_code}</div>
                            <div className="text-gray-600 text-xs">{mapping.sub_program_activities?.activity_name}</div>
                          </td>
<td className="px-3 py-2 text-sm">
                            {mapping.indicators ? (
                              <>
                                <div className="text-gray-900">{mapping.indicators.code}</div>
                                <div className="text-gray-600 text-xs">{mapping.indicators.name}</div>
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">Gösterge atanmamış</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(mapping)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                title="Düzenle"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(mapping.id)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredMappings.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
            Toplam {filteredMappings.length} eşleştirme
          </div>
        )}
      </div>
    </div>
  );
}
