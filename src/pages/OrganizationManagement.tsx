import { useState, useEffect } from 'react';
import { Building2, Briefcase, ClipboardList, Users, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Position {
  id: string;
  code: string;
  title: string;
  description: string;
  level: 'üst_yönetim' | 'orta_kademe' | 'alt_kademe' | 'operasyonel';
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Duty {
  id: string;
  department_id: string;
  position_id: string;
  duty_title: string;
  duty_description: string;
  responsibility_area: string;
  authority_level: string;
  display_order: number;
  department_name?: string;
  position_title?: string;
}

interface Assignment {
  id: string;
  user_id: string;
  department_id: string;
  position_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  assignment_type: 'asıl' | 'vekil' | 'geçici';
  notes: string;
  user_name?: string;
  department_name?: string;
  position_title?: string;
}

interface User {
  id: string;
  full_name: string;
}

const LEVEL_LABELS = {
  üst_yönetim: 'Üst Yönetim',
  orta_kademe: 'Orta Kademe',
  alt_kademe: 'Alt Kademe',
  operasyonel: 'Operasyonel'
};

const LEVEL_COLORS = {
  üst_yönetim: 'bg-red-100 text-red-800',
  orta_kademe: 'bg-blue-100 text-blue-800',
  alt_kademe: 'bg-green-100 text-green-800',
  operasyonel: 'bg-gray-100 text-gray-800'
};

export default function OrganizationManagement() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'departments' | 'positions' | 'duties' | 'assignments'>('departments');
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [showPositionForm, setShowPositionForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionForm, setPositionForm] = useState({
    title: '',
    description: '',
    level: 'operasyonel' as const
  });

  const [showDutyForm, setShowDutyForm] = useState(false);
  const [editingDuty, setEditingDuty] = useState<Duty | null>(null);
  const [dutyForm, setDutyForm] = useState({
    department_id: '',
    position_id: '',
    duty_title: '',
    duty_description: '',
    responsibility_area: '',
    authority_level: '',
    display_order: 0
  });

  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    user_id: '',
    department_id: '',
    position_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
    assignment_type: 'asıl' as const,
    notes: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadAllData();
    }
  }, [profile?.organization_id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDepartments(),
        loadPositions(),
        loadDuties(),
        loadAssignments(),
        loadUsers()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('organization_id', profile.organization_id)
      .order('name');

    if (error) {
      console.error('Birimler yüklenemedi:', error);
      return;
    }

    setDepartments(data || []);
  };

  const loadPositions = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('organization_positions')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('level')
      .order('title');

    if (error) {
      console.error('Ünvanlar yüklenemedi:', error);
      return;
    }

    setPositions(data || []);
  };

  const loadDuties = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('department_position_duties')
      .select(`
        *,
        departments(name),
        organization_positions(title)
      `)
      .eq('organization_id', profile.organization_id)
      .order('display_order');

    if (error) {
      console.error('Görevler yüklenemedi:', error);
      return;
    }

    setDuties((data || []).map((d: any) => ({
      ...d,
      department_name: d.departments?.name,
      position_title: d.organization_positions?.title
    })));
  };

  const loadAssignments = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('user_position_assignments')
      .select(`
        *,
        profiles(full_name),
        departments(name),
        organization_positions(title)
      `)
      .eq('organization_id', profile.organization_id)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Atamalar yüklenemedi:', error);
      return;
    }

    setAssignments((data || []).map((a: any) => ({
      ...a,
      user_name: a.profiles?.full_name,
      department_name: a.departments?.name,
      position_title: a.organization_positions?.title
    })));
  };

  const loadUsers = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', profile.organization_id)
      .order('full_name');

    if (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
      return;
    }

    setUsers(data || []);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const dataToSave = {
        ...positionForm,
        organization_id: profile.organization_id
      };

      if (editingPosition) {
        const { error } = await supabase
          .from('organization_positions')
          .update(dataToSave)
          .eq('id', editingPosition.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_positions')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowPositionForm(false);
      setEditingPosition(null);
      setPositionForm({ title: '', description: '', level: 'operasyonel' });
      loadPositions();
    } catch (error: any) {
      console.error('Ünvan kaydedilemedi:', error);
      alert('Hata: ' + error.message);
    }
  };

  const handleDeletePosition = async (id: string) => {
    if (!confirm('Bu ünvanı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('organization_positions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPositions();
    } catch (error: any) {
      console.error('Ünvan silinemedi:', error);
      alert('Bu ünvana bağlı görevler veya atamalar olabilir.');
    }
  };

  const handleSaveDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const dataToSave = {
        ...dutyForm,
        organization_id: profile.organization_id
      };

      if (editingDuty) {
        const { error } = await supabase
          .from('department_position_duties')
          .update(dataToSave)
          .eq('id', editingDuty.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('department_position_duties')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowDutyForm(false);
      setEditingDuty(null);
      setDutyForm({
        department_id: '',
        position_id: '',
        duty_title: '',
        duty_description: '',
        responsibility_area: '',
        authority_level: '',
        display_order: 0
      });
      loadDuties();
    } catch (error: any) {
      console.error('Görev kaydedilemedi:', error);
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteDuty = async (id: string) => {
    if (!confirm('Bu görevi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('department_position_duties')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadDuties();
    } catch (error) {
      console.error('Görev silinemedi:', error);
      alert('Görev silinemedi.');
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const dataToSave = {
        ...assignmentForm,
        end_date: assignmentForm.end_date || null,
        organization_id: profile.organization_id
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('user_position_assignments')
          .update(dataToSave)
          .eq('id', editingAssignment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_position_assignments')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowAssignmentForm(false);
      setEditingAssignment(null);
      setAssignmentForm({
        user_id: '',
        department_id: '',
        position_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        is_active: true,
        assignment_type: 'asıl',
        notes: ''
      });
      loadAssignments();
    } catch (error: any) {
      console.error('Atama kaydedilemedi:', error);
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Bu atamayı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('user_position_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadAssignments();
    } catch (error) {
      console.error('Atama silinemedi:', error);
      alert('Atama silinemedi.');
    }
  };

  const canEdit = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organizasyon Yönetimi</h1>
            <p className="text-sm text-gray-600">Birimler, Ünvanlar, Görevler ve Personel Atamaları</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'departments'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Birimler
              </div>
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'positions'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Ünvan Tanımları
              </div>
            </button>
            <button
              onClick={() => setActiveTab('duties')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'duties'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Görev Tanımları
              </div>
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'assignments'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Personel Atamaları
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'departments' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Birimler</h2>
                <p className="text-sm text-gray-600">
                  Birim yönetimi için "Müdürlükler" sayfasını kullanın
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map(dept => (
                  <div key={dept.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-blue-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{dept.name}</p>
                        <p className="text-xs text-gray-500">{dept.code}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'positions' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Ünvan Tanımları</h2>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingPosition(null);
                      setPositionForm({ title: '', description: '', level: 'operasyonel' });
                      setShowPositionForm(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Ünvan
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {positions.map(position => (
                  <div key={position.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-lg text-gray-900">{position.title}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">{position.code}</span>
                          <span className={`text-xs px-2 py-1 rounded ${LEVEL_COLORS[position.level]}`}>
                            {LEVEL_LABELS[position.level]}
                          </span>
                        </div>
                        {position.description && (
                          <p className="text-sm text-gray-600">{position.description}</p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingPosition(position);
                              setPositionForm({
                                title: position.title,
                                description: position.description || '',
                                level: position.level
                              });
                              setShowPositionForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePosition(position.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {positions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Henüz ünvan eklenmemiş. Yeni ünvan eklemek için yukarıdaki butonu kullanın.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'duties' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Görev Tanımları</h2>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingDuty(null);
                      setDutyForm({
                        department_id: '',
                        position_id: '',
                        duty_title: '',
                        duty_description: '',
                        responsibility_area: '',
                        authority_level: '',
                        display_order: 0
                      });
                      setShowDutyForm(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Görev
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {duties.map(duty => (
                  <div key={duty.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">{duty.duty_title}</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {duty.department_name}
                          </span>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                            {duty.position_title}
                          </span>
                        </div>
                        {duty.duty_description && (
                          <p className="text-sm text-gray-600 mb-2">{duty.duty_description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {duty.responsibility_area && (
                            <div>
                              <span className="font-medium text-gray-700">Sorumluluk Alanı:</span>
                              <p className="text-gray-600">{duty.responsibility_area}</p>
                            </div>
                          )}
                          {duty.authority_level && (
                            <div>
                              <span className="font-medium text-gray-700">Yetki Seviyesi:</span>
                              <p className="text-gray-600">{duty.authority_level}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingDuty(duty);
                              setDutyForm({
                                department_id: duty.department_id,
                                position_id: duty.position_id,
                                duty_title: duty.duty_title,
                                duty_description: duty.duty_description || '',
                                responsibility_area: duty.responsibility_area || '',
                                authority_level: duty.authority_level || '',
                                display_order: duty.display_order
                              });
                              setShowDutyForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDuty(duty.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {duties.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Henüz görev eklenmemiş. Yeni görev eklemek için yukarıdaki butonu kullanın.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Personel Atamaları</h2>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingAssignment(null);
                      setAssignmentForm({
                        user_id: '',
                        department_id: '',
                        position_id: '',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: '',
                        is_active: true,
                        assignment_type: 'asıl',
                        notes: ''
                      });
                      setShowAssignmentForm(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Atama
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ünvan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atama Türü</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Başlangıç</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bitiş</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                      {canEdit && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assignments.map(assignment => (
                      <tr key={assignment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {assignment.user_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {assignment.department_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {assignment.position_title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs px-2 py-1 rounded ${
                            assignment.assignment_type === 'asıl' ? 'bg-green-100 text-green-800' :
                            assignment.assignment_type === 'vekil' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {assignment.assignment_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(assignment.start_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {assignment.end_date ? new Date(assignment.end_date).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs px-2 py-1 rounded ${
                            assignment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {assignment.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => {
                                setEditingAssignment(assignment);
                                setAssignmentForm({
                                  user_id: assignment.user_id,
                                  department_id: assignment.department_id,
                                  position_id: assignment.position_id,
                                  start_date: assignment.start_date,
                                  end_date: assignment.end_date || '',
                                  is_active: assignment.is_active,
                                  assignment_type: assignment.assignment_type,
                                  notes: assignment.notes || ''
                                });
                                setShowAssignmentForm(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignments.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Henüz atama yapılmamış. Yeni atama eklemek için yukarıdaki butonu kullanın.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPositionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingPosition ? 'Ünvan Düzenle' : 'Yeni Ünvan'}
              </h2>
              <form onSubmit={handleSavePosition} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ünvan Adı *</label>
                  <input
                    type="text"
                    required
                    value={positionForm.title}
                    onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="örn: Müdür, Şef, Uzman"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seviye *</label>
                  <select
                    required
                    value={positionForm.level}
                    onChange={(e) => setPositionForm({ ...positionForm, level: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                  <textarea
                    value={positionForm.description}
                    onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPositionForm(false);
                      setEditingPosition(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDutyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingDuty ? 'Görev Düzenle' : 'Yeni Görev'}
              </h2>
              <form onSubmit={handleSaveDuty} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Birim *</label>
                    <select
                      required
                      value={dutyForm.department_id}
                      onChange={(e) => setDutyForm({ ...dutyForm, department_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seçiniz</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ünvan *</label>
                    <select
                      required
                      value={dutyForm.position_id}
                      onChange={(e) => setDutyForm({ ...dutyForm, position_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seçiniz</option>
                      {positions.map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Görev Başlığı *</label>
                  <input
                    type="text"
                    required
                    value={dutyForm.duty_title}
                    onChange={(e) => setDutyForm({ ...dutyForm, duty_title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Görev Açıklaması</label>
                  <textarea
                    value={dutyForm.duty_description}
                    onChange={(e) => setDutyForm({ ...dutyForm, duty_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sorumluluk Alanı</label>
                  <input
                    type="text"
                    value={dutyForm.responsibility_area}
                    onChange={(e) => setDutyForm({ ...dutyForm, responsibility_area: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yetki Seviyesi</label>
                  <input
                    type="text"
                    value={dutyForm.authority_level}
                    onChange={(e) => setDutyForm({ ...dutyForm, authority_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDutyForm(false);
                      setEditingDuty(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAssignmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingAssignment ? 'Atama Düzenle' : 'Yeni Atama'}
              </h2>
              <form onSubmit={handleSaveAssignment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Personel *</label>
                  <select
                    required
                    value={assignmentForm.user_id}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seçiniz</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Birim *</label>
                    <select
                      required
                      value={assignmentForm.department_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, department_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seçiniz</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ünvan *</label>
                    <select
                      required
                      value={assignmentForm.position_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, position_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seçiniz</option>
                      {positions.map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi *</label>
                    <input
                      type="date"
                      required
                      value={assignmentForm.start_date}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={assignmentForm.end_date}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Atama Türü *</label>
                    <select
                      required
                      value={assignmentForm.assignment_type}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, assignment_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="asıl">Asıl</option>
                      <option value="vekil">Vekil</option>
                      <option value="geçici">Geçici</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                    <label className="flex items-center mt-2">
                      <input
                        type="checkbox"
                        checked={assignmentForm.is_active}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Aktif</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                  <textarea
                    value={assignmentForm.notes}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignmentForm(false);
                      setEditingAssignment(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
