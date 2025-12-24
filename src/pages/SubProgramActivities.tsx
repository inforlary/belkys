import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Save, X, Search, Trash2, Edit2 } from 'lucide-react';

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

interface Activity {
  id: string;
  sub_program_id: string;
  activity_code: string;
  activity_name: string;
  description: string;
  sub_program: {
    full_code: string;
    name: string;
    program: {
      code: string;
      name: string;
    };
  };
}

export default function SubProgramActivities() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    program_id: '',
    sub_program_id: '',
    activity_code: '',
    activity_name: '',
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

      const [{ data: progData }, { data: subProgData }, { data: actData }] = await Promise.all([
        supabase.from('programs').select('id, code, name').eq('organization_id', profile.organization_id).order('code'),
        supabase.from('sub_programs').select('id, program_id, code, full_code, name').eq('organization_id', profile.organization_id).order('full_code'),
        supabase.from('sub_program_activities').select(`
          *,
          sub_program:sub_programs(
            full_code,
            name,
            program:programs(code, name)
          )
        `).order('created_at', { ascending: false })
      ]);

      setPrograms(progData || []);
      setSubPrograms(subProgData || []);
      setActivities(actData || []);
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
        sub_program_id: formData.sub_program_id,
        activity_code: formData.activity_code,
        activity_name: formData.activity_name,
        description: formData.description
      };

      if (editingId) {
        const { error } = await supabase
          .from('sub_program_activities')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        alert('Faaliyet güncellendi');
      } else {
        const { error } = await supabase
          .from('sub_program_activities')
          .insert([payload]);

        if (error) throw error;
        alert('Faaliyet oluşturuldu');
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving activity:', error);
      alert(error.message || 'Kayıt sırasında hata oluştu');
    }
  }

  function resetForm() {
    setFormData({
      program_id: '',
      sub_program_id: '',
      activity_code: '',
      activity_name: '',
      description: ''
    });
    setShowForm(false);
    setEditingId(null);
  }

  function editActivity(activity: Activity) {
    const subProgram = subPrograms.find(sp => sp.id === activity.sub_program_id);
    setFormData({
      program_id: subProgram?.program_id || '',
      sub_program_id: activity.sub_program_id,
      activity_code: activity.activity_code,
      activity_name: activity.activity_name,
      description: activity.description || ''
    });
    setEditingId(activity.id);
    setShowForm(true);
  }

  async function deleteActivity(id: string) {
    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('sub_program_activities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Faaliyet silindi');
      loadData();
    } catch (error: any) {
      console.error('Error deleting activity:', error);
      alert(error.message || 'Silme sırasında hata oluştu');
    }
  }

  const filteredActivities = activities.filter(a =>
    a.activity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.activity_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.sub_program?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSubPrograms = subPrograms.filter(sp => sp.program_id === formData.program_id);

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
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alt Program Faaliyetleri</h1>
            <p className="mt-1 text-indigo-100">
              Alt programlara ait faaliyet tanımlarını yönetin
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-white text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showForm ? 'İptal' : 'Yeni Faaliyet'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Faaliyeti Düzenle' : 'Yeni Faaliyet Oluştur'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program *
                </label>
                <select
                  required
                  value={formData.program_id}
                  onChange={(e) => setFormData({ ...formData, program_id: e.target.value, sub_program_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  onChange={(e) => setFormData({ ...formData, sub_program_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={!formData.program_id}
                >
                  <option value="">Seçiniz</option>
                  {filteredSubPrograms.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.full_code} - {sp.name}</option>
                  ))}
                </select>
              </div>

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Faaliyet Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.activity_name}
                  onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
                  placeholder="Faaliyet adını giriniz"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="İsteğe bağlı açıklama"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
              Faaliyetler ({filteredActivities.length})
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ara..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Alt Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Faaliyet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Açıklama</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {activity.sub_program?.program?.code} - {activity.sub_program?.program?.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700">
                      {activity.sub_program?.full_code} - {activity.sub_program?.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {activity.activity_code} - {activity.activity_name}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">
                      {activity.description || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => editActivity(activity)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteActivity(activity.id)}
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

        {filteredActivities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz faaliyet oluşturulmamış'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
