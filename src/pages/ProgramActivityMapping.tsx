import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Save, X, Search, Link as LinkIcon, Trash2, Edit2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface Program {
  id: string;
  code: string;
  name: string;
}

interface SubProgram {
  id: string;
  program_id: string;
  code: string;
  full_code: string;
  name: string;
}

interface SubProgramActivity {
  id: string;
  sub_program_id: string;
  activity_code: string;
  activity_name: string;
  description: string;
}

interface StrategicActivity {
  id: string;
  title: string;
  goal: {
    title: string;
    objective: {
      title: string;
    };
  };
}

interface Mapping {
  id: string;
  department_id: string;
  department: { name: string };
  program_id: string;
  program: { code: string; name: string };
  sub_program_id: string;
  sub_program: { code: string; full_code: string; name: string };
  activity_code: string;
  activity_name: string;
  strategic_activity_id: string | null;
  strategic_activity: StrategicActivity | null;
  description: string;
  status: string;
}

export default function ProgramActivityMapping() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [subProgramActivities, setSubProgramActivities] = useState<SubProgramActivity[]>([]);
  const [strategicActivities, setStrategicActivities] = useState<StrategicActivity[]>([]);
  const [allStrategicActivities, setAllStrategicActivities] = useState<StrategicActivity[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    department_id: '',
    program_id: '',
    sub_program_id: '',
    activity_code: '',
    activity_name: '',
    strategic_activity_id: '',
    description: ''
  });

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  async function loadData() {
    try {
      setLoading(true);

      const [
        { data: deptData },
        { data: progData },
        { data: subProgData },
        { data: subProgActData },
        { data: actData },
        { data: mappingData }
      ] = await Promise.all([
        supabase.from('departments').select('id, name').eq('organization_id', profile.organization_id).order('name'),
        supabase.from('programs').select('id, code, name').eq('organization_id', profile.organization_id).order('code'),
        supabase.from('sub_programs').select('id, program_id, code, full_code, name').eq('organization_id', profile.organization_id).order('full_code'),
        supabase.from('sub_program_activities').select('*').order('activity_code'),
        supabase.from('activities').select('id, title, department_id, goal:goals(title, objective:objectives(title))').eq('organization_id', profile.organization_id).order('title'),
        supabase.from('program_activity_mappings').select(`
          *,
          department:departments(name),
          program:programs(code, name),
          sub_program:sub_programs(code, full_code, name),
          strategic_activity:activities(id, title, goal:goals(title, objective:objectives(title)))
        `).eq('organization_id', profile.organization_id).order('created_at', { ascending: false })
      ]);

      setDepartments(deptData || []);
      setPrograms(progData || []);
      setSubPrograms(subProgData || []);
      setSubProgramActivities(subProgActData || []);
      setAllStrategicActivities(actData || []);
      setStrategicActivities(actData || []);
      setMappings(mappingData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        organization_id: profile.organization_id,
        department_id: formData.department_id,
        program_id: formData.program_id,
        sub_program_id: formData.sub_program_id,
        activity_code: formData.activity_code,
        activity_name: formData.activity_name,
        strategic_activity_id: formData.strategic_activity_id || null,
        description: formData.description,
        created_by: profile.id,
        updated_by: profile.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('program_activity_mappings')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        alert('Eşleştirme güncellendi');
      } else {
        const { error } = await supabase
          .from('program_activity_mappings')
          .insert([payload]);

        if (error) throw error;
        alert('Eşleştirme oluşturuldu');
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving mapping:', error);
      alert(error.message || 'Kayıt sırasında hata oluştu');
    }
  }

  function resetForm() {
    setFormData({
      department_id: '',
      program_id: '',
      sub_program_id: '',
      activity_code: '',
      activity_name: '',
      strategic_activity_id: '',
      description: ''
    });
    setShowForm(false);
    setEditingId(null);
  }

  function editMapping(mapping: Mapping) {
    setFormData({
      department_id: mapping.department_id,
      program_id: mapping.program_id,
      sub_program_id: mapping.sub_program_id,
      activity_code: mapping.activity_code,
      activity_name: mapping.activity_name,
      strategic_activity_id: mapping.strategic_activity_id || '',
      description: mapping.description || ''
    });

    const filtered = allStrategicActivities.filter(
      a => a.department_id === mapping.department_id
    );
    setStrategicActivities(filtered);

    setEditingId(mapping.id);
    setShowForm(true);
  }

  async function deleteMapping(id: string) {
    if (!confirm('Bu eşleştirmeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('program_activity_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Eşleştirme silindi');
      loadData();
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      alert(error.message || 'Silme sırasında hata oluştu');
    }
  }

  const filteredMappings = mappings.filter(m =>
    m.activity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.program.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSubPrograms = subPrograms.filter(sp => sp.program_id === formData.program_id);

  const filteredSubProgramActivities = subProgramActivities.filter(
    spa => spa.sub_program_id === formData.sub_program_id
  );

  useEffect(() => {
    if (formData.department_id) {
      const filtered = allStrategicActivities.filter(
        a => a.department_id === formData.department_id
      );
      setStrategicActivities(filtered);
    } else {
      setStrategicActivities(allStrategicActivities);
    }
  }, [formData.department_id, allStrategicActivities]);

  const handleDepartmentChange = (departmentId: string) => {
    setFormData({
      ...formData,
      department_id: departmentId,
      strategic_activity_id: ''
    });
  };

  const handleSubProgramChange = (subProgramId: string) => {
    setFormData({
      ...formData,
      sub_program_id: subProgramId,
      activity_code: '',
      activity_name: ''
    });
  };

  const handleActivitySelect = (activityId: string) => {
    const selected = filteredSubProgramActivities.find(a => a.id === activityId);
    if (selected) {
      setFormData({
        ...formData,
        activity_code: selected.activity_code,
        activity_name: selected.activity_name
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Program-Faaliyet Eşleştirme</h1>
            <p className="mt-1 text-green-100">
              Müdürlüklerin program yapısını stratejik plan faaliyetleri ile eşleştirin
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-white text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showForm ? 'İptal' : 'Yeni Eşleştirme'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Eşleştirmeyi Düzenle' : 'Yeni Eşleştirme Oluştur'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Müdürlük *
                </label>
                <select
                  required
                  value={formData.department_id}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seçiniz</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program *
                </label>
                <select
                  required
                  value={formData.program_id}
                  onChange={(e) => setFormData({ ...formData, program_id: e.target.value, sub_program_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seçiniz</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Program *
                </label>
                <select
                  required
                  value={formData.sub_program_id}
                  onChange={(e) => handleSubProgramChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  disabled={!formData.program_id}
                >
                  <option value="">Seçiniz</option>
                  {filteredSubPrograms.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.full_code} - {sp.name}</option>
                  ))}
                </select>
              </div>

              {formData.sub_program_id && filteredSubProgramActivities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Faaliyet Seç (Opsiyonel)
                  </label>
                  <select
                    value=""
                    onChange={(e) => handleActivitySelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Listeden seçiniz veya manuel girin</option>
                    {filteredSubProgramActivities.map(spa => (
                      <option key={spa.id} value={spa.id}>
                        {spa.activity_code} - {spa.activity_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faaliyet Kodu *
                </label>
                <input
                  type="text"
                  required
                  value={formData.activity_code}
                  onChange={(e) => setFormData({ ...formData, activity_code: e.target.value })}
                  placeholder="Örn: 01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faaliyet Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.activity_name}
                  onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
                  placeholder="Faaliyet adını giriniz"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stratejik Plan Faaliyeti ile Eşleştir
                </label>
                {formData.department_id ? (
                  <>
                    <select
                      value={formData.strategic_activity_id}
                      onChange={(e) => setFormData({ ...formData, strategic_activity_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Eşleştirme yapılmayacak</option>
                      {strategicActivities.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.title} ({a.goal?.objective?.title})
                        </option>
                      ))}
                    </select>
                    {strategicActivities.length === 0 && (
                      <p className="mt-1 text-sm text-amber-600">
                        Seçilen müdürlüğe ait stratejik faaliyet bulunamadı.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic py-2">
                    Önce müdürlük seçimi yapınız
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="İsteğe bağlı açıklama giriniz"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{editingId ? 'Güncelle' : 'Kaydet'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Eşleştirmeler ({filteredMappings.length})
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ara..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Müdürlük</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Program Yapısı</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Faaliyet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stratejik Eşleştirme</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMappings.map((mapping) => (
                <tr key={mapping.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{mapping.department.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">
                      <div className="font-medium">{mapping.program.code} - {mapping.program.name}</div>
                      <div>{mapping.sub_program.full_code} - {mapping.sub_program.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{mapping.activity_code} - {mapping.activity_name}</div>
                      {mapping.description && (
                        <div className="text-xs text-gray-500 mt-1">{mapping.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {mapping.strategic_activity ? (
                      <div className="flex items-start space-x-2">
                        <LinkIcon className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-gray-700">
                          {mapping.strategic_activity.title}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Eşleştirme yok</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => editMapping(mapping)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMapping(mapping.id)}
                        className="text-red-600 hover:text-red-700"
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

        {filteredMappings.length === 0 && (
          <div className="text-center py-12">
            <LinkIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz eşleştirme oluşturulmamış'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
