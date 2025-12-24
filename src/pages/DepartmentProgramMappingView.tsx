import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Search, Filter, FileText, Edit2, Save, X } from 'lucide-react';
import Modal from '../components/ui/Modal';

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
  code: string;
  name: string;
  full_code: string;
}

interface Activity {
  id: string;
  activity_name: string;
  activity_code: string;
}

interface Indicator {
  id: string;
  code: string;
  name: string;
}

interface Goal {
  id: string;
  code: string;
  title: string;
  department_id: string;
}

interface Mapping {
  id: string;
  department_id: string;
  program_id: string;
  sub_program_id: string;
  activity_id: string;
  indicator_id: string | null;
  notes: string | null;
  description_status: string;
  description_submitted_at: string | null;
  description_reviewed_at: string | null;
  description_reviewed_by: string | null;
  description_rejection_reason: string | null;
  departments?: Department;
  programs?: Program;
  sub_programs?: SubProgram;
  sub_program_activities?: Activity;
  indicators?: Indicator | null;
  created_at: string;
}

interface SubProgramGoal {
  id: string;
  organization_id: string;
  department_id: string;
  sub_program_id: string;
  goal_id: string;
  notes: string | null;
  goals?: Goal;
}

export default function DepartmentProgramMappingView() {
  const { profile } = useAuth();
  const { navigate } = useLocation();

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subProgramGoals, setSubProgramGoals] = useState<SubProgramGoal[]>([]);
  const [departmentGoals, setDepartmentGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    department_id: '',
    program_id: '',
    sub_program_id: '',
    search: ''
  });

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingSubProgramId, setEditingSubProgramId] = useState<string | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editGoalId, setEditGoalId] = useState('');
  const [editGoalNotes, setEditGoalNotes] = useState('');

  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

const loadData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      let mappingsQuery = supabase
        .from('program_activity_indicator_mappings')
        .select(`
          *,
          departments(id, name),
          programs(id, code, name),
          sub_programs(id, code, name, full_code),
          sub_program_activities(id, activity_name, activity_code),
          indicators(id, code, name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (profile.role !== 'admin' && profile.role !== 'super_admin' && profile.department_id) {
        mappingsQuery = mappingsQuery.eq('department_id', profile.department_id);
      }

      let subProgramGoalsQuery = supabase
        .from('department_sub_program_goals')
        .select(`
          *,
          goals(id, code, title, department_id)
        `)
        .eq('organization_id', profile.organization_id);

      if (profile.role !== 'admin' && profile.role !== 'super_admin' && profile.department_id) {
        subProgramGoalsQuery = subProgramGoalsQuery.eq('department_id', profile.department_id);
      }

      const [mappingsRes, departmentsRes, goalsRes, subProgramGoalsRes] = await Promise.all([
        mappingsQuery,
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name'),
        supabase
          .from('goals')
          .select('id, code, title, department_id')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        subProgramGoalsQuery
      ]);

      const uniqueProgramIds = [...new Set(mappingsRes.data?.map(m => m.program_id) || [])];
      const uniqueSubProgramIds = [...new Set(mappingsRes.data?.map(m => m.sub_program_id) || [])];

      const [programsRes, subProgramsRes] = await Promise.all([
        uniqueProgramIds.length > 0
          ? supabase
              .from('programs')
              .select('id, code, name')
              .in('id', uniqueProgramIds)
              .eq('is_active', true)
              .order('code')
          : Promise.resolve({ data: [], error: null }),
        uniqueSubProgramIds.length > 0
          ? supabase
              .from('sub_programs')
              .select('id, code, name, full_code')
              .in('id', uniqueSubProgramIds)
              .eq('is_active', true)
              .order('full_code')
          : Promise.resolve({ data: [], error: null })
      ]);

      if (mappingsRes.data) setMappings(mappingsRes.data);
      if (departmentsRes.data) setDepartments(departmentsRes.data);
      if (programsRes.data) setPrograms(programsRes.data);
      if (subProgramsRes.data) setSubPrograms(subProgramsRes.data);
      if (goalsRes.data) setGoals(goalsRes.data);
      if (subProgramGoalsRes.data) setSubProgramGoals(subProgramGoalsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veri yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

const canEditMapping = (mapping: Mapping) => {
    if (!profile) return false;

    if (profile.role === 'admin' || profile.role === 'vice_president') {
      return true;
    }

    if (profile.role === 'manager' && profile.department_id === mapping.department_id) {
      return true;
    }

    return false;
  };

  const handleSetGoalClick = (subProgramId: string, departmentId: string) => {
    setEditingSubProgramId(subProgramId);
    setEditingDepartmentId(departmentId);

    const existingGoal = subProgramGoals.find(
      sg => sg.sub_program_id === subProgramId && sg.department_id === departmentId
    );

    if (existingGoal) {
      setEditGoalId(existingGoal.goal_id);
      setEditGoalNotes(existingGoal.notes || '');
    } else {
      setEditGoalId('');
      setEditGoalNotes('');
    }

    const filtered = goals.filter(g => g.department_id === departmentId);
    setDepartmentGoals(filtered);

    setShowGoalModal(true);
  };

  const handleSaveGoal = async () => {
    if (!editingSubProgramId || !editingDepartmentId || !editGoalId) {
      alert('Lütfen bir hedef seçiniz');
      return;
    }

    if (!editGoalNotes.trim()) {
      alert('Gerekçe ve Açıklamalar alanı zorunludur');
      return;
    }

    try {
      setSaving(true);

      const existingGoal = subProgramGoals.find(
        sg => sg.sub_program_id === editingSubProgramId && sg.department_id === editingDepartmentId
      );

      if (existingGoal) {
        const { error } = await supabase
          .from('department_sub_program_goals')
          .update({
            goal_id: editGoalId,
            notes: editGoalNotes,
            updated_by: profile?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingGoal.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('department_sub_program_goals')
          .insert([{
            organization_id: profile?.organization_id,
            department_id: editingDepartmentId,
            sub_program_id: editingSubProgramId,
            goal_id: editGoalId,
            notes: editGoalNotes,
            created_by: profile?.id,
            updated_by: profile?.id
          }]);

        if (error) throw error;
      }

      await loadData();
      setShowGoalModal(false);
      setEditingSubProgramId(null);
      setEditingDepartmentId(null);
      setEditGoalId('');
      setEditGoalNotes('');
      alert('Hedef eşleştirmesi kaydedildi');
    } catch (error: any) {
      console.error('Error saving goal:', error);
      alert('Hedef kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditDescriptionClick = (mapping: Mapping) => {
    setEditingMapping(mapping);
    setEditNotes(mapping.notes || '');
    setShowDescriptionModal(true);
  };

  const handleSaveDescription = async (submitForApproval: boolean = false) => {
    if (!editingMapping) return;

    try {
      setSaving(true);

      const updateData: any = {
        notes: editNotes,
        updated_by: profile?.id,
        updated_at: new Date().toISOString()
      };

      if (submitForApproval) {
        updateData.description_status = 'pending_approval';
        updateData.description_submitted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('program_activity_indicator_mappings')
        .update(updateData)
        .eq('organization_id', profile?.organization_id)
        .eq('department_id', editingMapping.department_id)
        .eq('activity_id', editingMapping.activity_id);

      if (error) throw error;

      setMappings(mappings.map(m =>
        m.activity_id === editingMapping.activity_id && m.department_id === editingMapping.department_id
          ? { ...m, ...updateData }
          : m
      ));

      setShowDescriptionModal(false);
      setEditingMapping(null);
      setEditNotes('');
      alert(submitForApproval ? 'Açıklama onaya gönderildi' : 'Açıklama kaydedildi');
    } catch (error: any) {
      console.error('Error saving description:', error);
      alert('Açıklama kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveDescription = async (mappingId: string) => {
    if (!confirm('Bu açıklamayı onaylamak istediğinizden emin misiniz?')) return;

    try {
      const mapping = mappings.find(m => m.id === mappingId);
      if (!mapping) return;

      const { error } = await supabase
        .from('program_activity_indicator_mappings')
        .update({
          description_status: 'approved',
          description_reviewed_at: new Date().toISOString(),
          description_reviewed_by: profile?.id
        })
        .eq('organization_id', profile?.organization_id)
        .eq('department_id', mapping.department_id)
        .eq('activity_id', mapping.activity_id);

      if (error) throw error;

      await loadData();
      alert('Açıklama onaylandı');
    } catch (error: any) {
      console.error('Error approving description:', error);
      alert('Onaylama sırasında hata oluştu: ' + error.message);
    }
  };

  const handleRejectDescription = async (mappingId: string) => {
    const reason = prompt('Red nedeni giriniz:');
    if (!reason) return;

    try {
      const mapping = mappings.find(m => m.id === mappingId);
      if (!mapping) return;

      const { error } = await supabase
        .from('program_activity_indicator_mappings')
        .update({
          description_status: 'rejected',
          description_reviewed_at: new Date().toISOString(),
          description_reviewed_by: profile?.id,
          description_rejection_reason: reason
        })
        .eq('organization_id', profile?.organization_id)
        .eq('department_id', mapping.department_id)
        .eq('activity_id', mapping.activity_id);

      if (error) throw error;

      await loadData();
      alert('Açıklama reddedildi');
    } catch (error: any) {
      console.error('Error rejecting description:', error);
      alert('Reddetme sırasında hata oluştu: ' + error.message);
    }
  };

  const filteredMappings = mappings.filter(mapping => {
    if (filters.department_id && mapping.department_id !== filters.department_id) return false;
    if (filters.program_id && mapping.program_id !== filters.program_id) return false;
    if (filters.sub_program_id && mapping.sub_program_id !== filters.sub_program_id) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        mapping.departments?.name.toLowerCase().includes(searchLower) ||
        mapping.programs?.name.toLowerCase().includes(searchLower) ||
        mapping.sub_programs?.name.toLowerCase().includes(searchLower) ||
        mapping.sub_program_activities?.activity_name?.toLowerCase().includes(searchLower) ||
        mapping.indicators?.name?.toLowerCase().includes(searchLower) ||
        false
      );
    }
    return true;
  });

  const groupedMappings = filteredMappings.reduce((acc, mapping) => {
    const deptId = mapping.department_id;
    const deptName = mapping.departments?.name || 'Bilinmeyen Birim';
    if (!acc[deptId]) {
      acc[deptId] = { name: deptName, mappings: [] };
    }
    acc[deptId].mappings.push(mapping);
    return acc;
  }, {} as Record<string, { name: string; mappings: Mapping[] }>);

  const groupBySubProgram = (mappings: Mapping[]) => {
    return mappings.reduce((acc, mapping) => {
      const subProgId = mapping.sub_program_id;
      if (!acc[subProgId]) {
        acc[subProgId] = [];
      }
      acc[subProgId].push(mapping);
      return acc;
    }, {} as Record<string, Mapping[]>);
  };

  const groupByActivity = (mappings: Mapping[]) => {
    return mappings.reduce((acc, mapping) => {
      const activityId = mapping.activity_id || 'no-activity';
      if (!acc[activityId]) {
        acc[activityId] = [];
      }
      acc[activityId].push(mapping);
      return acc;
    }, {} as Record<string, Mapping[]>);
  };

  const getSubProgramGoal = (subProgramId: string, departmentId: string) => {
    return subProgramGoals.find(
      sg => sg.sub_program_id === subProgramId && sg.department_id === departmentId
    );
  };

  const getDescriptionStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      draft: { text: 'Taslak', className: 'bg-gray-100 text-gray-800' },
      pending_approval: { text: 'Onay Bekliyor', className: 'bg-yellow-100 text-yellow-800' },
      approved: { text: 'Onaylandı', className: 'bg-green-100 text-green-800' },
      rejected: { text: 'Reddedildi', className: 'bg-red-100 text-red-800' }
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Program Eşleştirmeleri</h1>
          <p className="text-gray-500 mt-1">
            {profile?.role === 'admin'
              ? 'Müdürlüklere atanmış programları görüntüleyin'
              : 'Müdürlüğünüze atanmış programları görüntüleyin'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Filtrele</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ara
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Program, faaliyet ara..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {profile?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Müdürlük
                </label>
                <select
                  value={filters.department_id}
                  onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tümü</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program
              </label>
              <select
                value={filters.program_id}
                onChange={(e) => setFilters({ ...filters, program_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>{prog.code} - {prog.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alt Program
              </label>
              <select
                value={filters.sub_program_id}
                onChange={(e) => setFilters({ ...filters, sub_program_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {subPrograms.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.full_code} - {sp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Toplam {filteredMappings.length} eşleştirme bulundu
            </div>
            <Button
              variant="outline"
              onClick={() => setFilters({ department_id: '', program_id: '', sub_program_id: '', search: '' })}
            >
              Filtreleri Temizle
            </Button>
          </div>
        </CardBody>
      </Card>

      {Object.entries(groupedMappings).length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Program eşleştirmesi bulunamadı</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        Object.entries(groupedMappings).map(([deptId, { name: deptName, mappings: deptMappings }]) => {
          const subProgramGroups = groupBySubProgram(deptMappings);

          return (
            <Card key={deptId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{deptName}</h2>
                  <div className="text-sm text-gray-500">
                    {deptMappings.length} faaliyet
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  {Object.entries(subProgramGroups).map(([subProgId, subProgMappings]) => {
                    const firstMapping = subProgMappings[0];
                    const subProgramGoal = getSubProgramGoal(subProgId, deptId);

                    return (
                      <div key={subProgId} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {firstMapping.programs?.code} - {firstMapping.sub_programs?.full_code}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-0.5">
                                    {firstMapping.programs?.name} / {firstMapping.sub_programs?.name}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                {subProgramGoal && subProgramGoal.goals ? (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Stratejik Hedef:</div>
                                    <div className="font-medium text-blue-600 text-sm">
                                      {subProgramGoal.goals.code}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {subProgramGoal.goals.title}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 italic">Hedef atanmamış</div>
                                )}
                              </div>
                              {canEditMapping(firstMapping) && (
                                <button
                                  onClick={() => handleSetGoalClick(subProgId, deptId)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  {subProgramGoal ? 'Hedef Düzenle' : 'Hedef Ata'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 p-4">
                          {Object.entries(groupByActivity(subProgMappings)).map(([activityId, activityMappings]) => {
                            const firstMapping = activityMappings[0];
                            const activityNotes = firstMapping.notes;
                            const activityStatus = firstMapping.description_status || 'draft';

                            return (
                              <div key={activityId} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      {firstMapping.sub_program_activities ? (
                                        <>
                                          <div className="font-semibold text-gray-900 text-base">
                                            {firstMapping.sub_program_activities.activity_code}
                                          </div>
                                          <div className="text-gray-700 text-sm mt-1">
                                            {firstMapping.sub_program_activities.activity_name}
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-gray-400">Faaliyet bilgisi yok</span>
                                      )}

                                      <div className="mt-3">
                                        <div className="text-xs font-medium text-gray-500 mb-1">İlgili Göstergeler:</div>
                                        <div className="flex flex-wrap gap-2">
                                          {activityMappings.map((mapping, idx) => (
                                            <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                                              {mapping.indicators ? (
                                                <>
                                                  <span className="font-medium text-blue-600">{mapping.indicators.code}</span>
                                                  <span className="text-gray-500">•</span>
                                                  <span className="text-gray-700">{mapping.indicators.name}</span>
                                                </>
                                              ) : (
                                                <span className="text-gray-400">Gösterge yok</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                      {getDescriptionStatusBadge(activityStatus)}
                                      {canEditMapping(firstMapping) && (
                                        <button
                                          onClick={() => handleEditDescriptionClick(firstMapping)}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Açıklama {activityNotes ? 'Düzenle' : 'Ekle'}
                                        </button>
                                      )}
                                      {profile?.role === 'admin' && activityStatus === 'pending_approval' && (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleApproveDescription(firstMapping.id)}
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                                          >
                                            Onayla
                                          </button>
                                          <button
                                            onClick={() => handleRejectDescription(firstMapping.id)}
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                          >
                                            Reddet
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="px-4 py-3">
                                  <div className="text-xs font-medium text-gray-500 mb-1">Açıklama:</div>
                                  {activityNotes ? (
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{activityNotes}</div>
                                  ) : (
                                    <div className="text-sm text-gray-400 italic">Açıklama eklenmemiş</div>
                                  )}
                                  {activityStatus === 'rejected' && firstMapping.description_rejection_reason && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                      <div className="text-xs font-medium text-red-700">Red Nedeni:</div>
                                      <div className="text-sm text-red-600 mt-0.5">{firstMapping.description_rejection_reason}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })
      )}

      {showGoalModal && (() => {
        const currentMapping = editingSubProgramId
          ? mappings.find(m => m.sub_program_id === editingSubProgramId)
          : null;

        return (
          <Modal
            isOpen={showGoalModal}
            onClose={() => {
              setShowGoalModal(false);
              setEditingSubProgramId(null);
              setEditingDepartmentId(null);
              setEditGoalId('');
              setEditGoalNotes('');
            }}
            title="Alt Program Hedefi Belirleme"
          >
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Bu alt programa ait tüm faaliyetler seçtiğiniz stratejik hedefle ilişkilendirilecektir.
                </p>
              </div>

              {currentMapping && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Program:</span>
                    <div className="text-sm text-gray-900 font-medium mt-0.5">
                      {currentMapping.programs?.code} - {currentMapping.programs?.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Alt Program:</span>
                    <div className="text-sm text-gray-900 font-medium mt-0.5">
                      {currentMapping.sub_programs?.full_code} - {currentMapping.sub_programs?.name}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stratejik Hedef <span className="text-red-500">*</span>
                </label>
                <select
                  value={editGoalId}
                  onChange={(e) => setEditGoalId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Hedef Seçiniz</option>
                  {departmentGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.code} - {goal.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Bu alt programın hangi stratejik hedefle ilişkili olduğunu seçiniz.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gerekçe ve Açıklamalar <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editGoalNotes}
                  onChange={(e) => setEditGoalNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="İlgili hedefin bu alt programa bağlanmasının gerekçesini ve açıklamalarını yazınız..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alt program kapsamında ilgili mevzuata göre idareye verilen hangi görevlerin yürütüldüğü ve Kalkınma Planı, Stratejik Plan gibi üst politika belgelerinde yer alan hedeflerden hangilerine ulaşılmasına katkı sağlandığına ilişkin açıklamalara yer verilecektir.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGoalModal(false);
                    setEditingSubProgramId(null);
                    setEditingDepartmentId(null);
                    setEditGoalId('');
                    setEditGoalNotes('');
                  }}
                  disabled={saving}
                >
                  <X className="w-4 h-4 mr-1" />
                  İptal
                </Button>
                <Button
                  onClick={handleSaveGoal}
                  disabled={saving || !editGoalId || !editGoalNotes.trim()}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {showDescriptionModal && editingMapping && (
        <Modal
          isOpen={showDescriptionModal}
          onClose={() => {
            setShowDescriptionModal(false);
            setEditingMapping(null);
            setEditNotes('');
          }}
          title="Faaliyet Açıklaması"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500">Faaliyet:</span>
                <div className="text-sm text-gray-900 font-medium mt-0.5">
                  {editingMapping.sub_program_activities?.activity_code} - {editingMapping.sub_program_activities?.activity_name}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Program:</span>
                <div className="text-sm text-gray-900 mt-0.5">
                  {editingMapping.programs?.code} - {editingMapping.programs?.name}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Alt Program:</span>
                <div className="text-sm text-gray-900 mt-0.5">
                  {editingMapping.sub_programs?.full_code} - {editingMapping.sub_programs?.name}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-1">İlgili Göstergeler:</span>
                <div className="flex flex-wrap gap-1.5">
                  {mappings
                    .filter(m => m.activity_id === editingMapping.activity_id)
                    .map((mapping, idx) => (
                      <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                        {mapping.indicators ? (
                          <>
                            <span className="font-medium text-blue-600">{mapping.indicators.code}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-700">{mapping.indicators.name}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">Gösterge yok</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Durum:</span>
                <div className="mt-1">
                  {getDescriptionStatusBadge(editingMapping.description_status || 'draft')}
                </div>
              </div>
              {editingMapping.description_status === 'rejected' && editingMapping.description_rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
                  <span className="text-xs font-medium text-red-700">Red Nedeni:</span>
                  <div className="text-sm text-red-600 mt-1">
                    {editingMapping.description_rejection_reason}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Faaliyet Açıklaması <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Bu faaliyetle ilgili detaylı açıklama ekleyiniz..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Bu alan zorunludur. Faaliyetle ilgili detaylı açıklama ekleyiniz.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDescriptionModal(false);
                  setEditingMapping(null);
                  setEditNotes('');
                }}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-1" />
                İptal
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSaveDescription(false)}
                disabled={saving || !editNotes.trim()}
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              {(editingMapping.description_status === 'draft' || editingMapping.description_status === 'rejected') && (
                <Button
                  onClick={() => handleSaveDescription(true)}
                  disabled={saving || !editNotes.trim()}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  {saving ? 'Gönderiliyor...' : 'Onaya Gönder'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
