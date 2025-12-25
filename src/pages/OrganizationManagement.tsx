import { useState, useEffect } from 'react';
import { GitBranch, Plus, Edit2, Trash2, Users, Shield, ChevronRight, ChevronDown, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface Position {
  id: string;
  code: string;
  title: string;
  description: string;
  level: 'üst_yönetim' | 'orta_kademe' | 'alt_kademe' | 'operasyonel';
  parent_position_id: string | null;
  responsibilities: string;
  authorities: string;
  qualifications: string;
  reports_to: string;
  supervises: string;
  children?: Position[];
  assignments?: Assignment[];
  authorities_list?: Authority[];
}

interface Assignment {
  id: string;
  user_id: string;
  user_name?: string;
  department_name?: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  assignment_type: 'asıl' | 'vekil' | 'geçici';
}

interface Authority {
  id: string;
  authority_category: string;
  authority_type: string;
  authority_description: string;
  authority_limit: number | null;
  can_approve: boolean;
  can_reject: boolean;
  can_delegate: boolean;
}

const LEVEL_LABELS = {
  üst_yönetim: 'Üst Yönetim',
  orta_kademe: 'Orta Kademe',
  alt_kademe: 'Alt Kademe',
  operasyonel: 'Operasyonel'
};

const LEVEL_COLORS = {
  üst_yönetim: 'bg-purple-100 text-purple-800 border-purple-300',
  orta_kademe: 'bg-blue-100 text-blue-800 border-blue-300',
  alt_kademe: 'bg-green-100 text-green-800 border-green-300',
  operasyonel: 'bg-gray-100 text-gray-800 border-gray-300'
};

export default function OrganizationManagement() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan } = useICPlan();
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'positions' | 'authorities'>('hierarchy');
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);

  const [positionForm, setPositionForm] = useState({
    title: '',
    description: '',
    level: 'operasyonel' as const,
    parent_position_id: '',
    responsibilities: '',
    authorities: '',
    qualifications: '',
    reports_to: '',
    supervises: ''
  });

  useEffect(() => {
    if (selectedPlanId && profile?.organization_id) {
      loadData();
    }
  }, [selectedPlanId, profile?.organization_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPositions(),
        loadDepartments(),
        loadUsers()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_positions')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('level', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;

      const positionsWithRelations = await Promise.all(
        (data || []).map(async (position) => {
          const [assignmentsRes, authoritiesRes] = await Promise.all([
            supabase
              .from('ic_position_assignments')
              .select(`
                *,
                profiles!ic_position_assignments_user_id_fkey(full_name),
                departments(name)
              `)
              .eq('position_id', position.id)
              .eq('is_active', true),
            supabase
              .from('ic_authority_matrix')
              .select('*')
              .eq('position_id', position.id)
              .eq('is_active', true)
          ]);

          return {
            ...position,
            assignments: (assignmentsRes.data || []).map((a: any) => ({
              ...a,
              user_name: a.profiles?.full_name,
              department_name: a.departments?.name
            })),
            authorities_list: authoritiesRes.data || []
          };
        })
      );

      setPositions(buildHierarchy(positionsWithRelations));
    } catch (error) {
      console.error('Pozisyonlar yüklenirken hata:', error);
    }
  };

  const buildHierarchy = (positions: Position[]): Position[] => {
    const positionMap = new Map<string, Position>();
    const roots: Position[] = [];

    positions.forEach(pos => {
      positionMap.set(pos.id, { ...pos, children: [] });
    });

    positionMap.forEach(position => {
      if (position.parent_position_id) {
        const parent = positionMap.get(position.parent_position_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(position);
        } else {
          roots.push(position);
        }
      } else {
        roots.push(position);
      }
    });

    return roots;
  };

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Müdürlükler yüklenirken hata:', error);
    }
  };

  const loadUsers = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, department_id')
        .eq('organization_id', profile.organization_id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
    }
  };

  const handleSubmitPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const dataToSave = {
        ...positionForm,
        parent_position_id: positionForm.parent_position_id || null,
        organization_id: profile.organization_id,
        ic_plan_id: selectedPlanId
      };

      if (editingPosition) {
        const { error } = await supabase
          .from('ic_positions')
          .update(dataToSave)
          .eq('id', editingPosition.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ic_positions')
          .insert(dataToSave);

        if (error) throw error;
      }

      setShowPositionForm(false);
      setEditingPosition(null);
      resetPositionForm();
      loadPositions();
    } catch (error: any) {
      console.error('Pozisyon kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setPositionForm({
      title: position.title,
      description: position.description || '',
      level: position.level,
      parent_position_id: position.parent_position_id || '',
      responsibilities: position.responsibilities || '',
      authorities: position.authorities || '',
      qualifications: position.qualifications || '',
      reports_to: position.reports_to || '',
      supervises: position.supervises || ''
    });
    setShowPositionForm(true);
  };

  const handleDeletePosition = async (id: string) => {
    if (!confirm('Bu pozisyonu silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_positions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPositions();
    } catch (error) {
      console.error('Pozisyon silinirken hata:', error);
      alert('Pozisyon silinemedi. Bu pozisyona bağlı kayıtlar olabilir.');
    }
  };

  const resetPositionForm = () => {
    setPositionForm({
      title: '',
      description: '',
      level: 'operasyonel',
      parent_position_id: '',
      responsibilities: '',
      authorities: '',
      qualifications: '',
      reports_to: '',
      supervises: ''
    });
  };

  const toggleExpand = (positionId: string) => {
    const newExpanded = new Set(expandedPositions);
    if (newExpanded.has(positionId)) {
      newExpanded.delete(positionId);
    } else {
      newExpanded.add(positionId);
    }
    setExpandedPositions(newExpanded);
  };

  const renderPositionNode = (position: Position, level: number = 0) => {
    const hasChildren = position.children && position.children.length > 0;
    const isExpanded = expandedPositions.has(position.id);

    return (
      <div key={position.id} className={`${level > 0 ? 'ml-8 mt-2' : 'mt-3'}`}>
        <div className={`border-2 rounded-lg p-4 ${LEVEL_COLORS[position.level]}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(position.id)}
                  className="mt-1 text-gray-600 hover:text-gray-800"
                >
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">{position.title}</span>
                  <span className="text-xs px-2 py-0.5 bg-white rounded">{position.code}</span>
                </div>
                {position.description && (
                  <p className="text-sm mb-2">{position.description}</p>
                )}
                {position.assignments && position.assignments.length > 0 && (
                  <div className="text-sm space-y-1 mt-2">
                    {position.assignments.map(assignment => (
                      <div key={assignment.id} className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="font-medium">{assignment.user_name}</span>
                        <span className="text-xs px-2 py-0.5 bg-white rounded">
                          {assignment.assignment_type}
                        </span>
                        {assignment.department_name && (
                          <span className="text-xs">({assignment.department_name})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEditPosition(position)}
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
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-2">
            {position.children!.map(child => renderPositionNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderPositionsList = () => {
    const flatPositions = positions.flatMap(function flatten(pos): Position[] {
      return [pos, ...(pos.children || []).flatMap(flatten)];
    });

    return (
      <div className="space-y-3">
        {flatPositions.map(position => (
          <div key={position.id} className="bg-white rounded-lg shadow p-4 border-l-4" style={{
            borderColor: position.level === 'üst_yönetim' ? '#9333ea' :
                        position.level === 'orta_kademe' ? '#3b82f6' :
                        position.level === 'alt_kademe' ? '#10b981' : '#6b7280'
          }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-lg">{position.title}</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">{position.code}</span>
                  <span className={`text-xs px-2 py-1 rounded ${LEVEL_COLORS[position.level]}`}>
                    {LEVEL_LABELS[position.level]}
                  </span>
                </div>
                {position.description && (
                  <p className="text-sm text-gray-600 mb-2">{position.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                  {position.responsibilities && (
                    <div>
                      <span className="font-medium text-gray-700">Sorumluluklar:</span>
                      <p className="text-gray-600 mt-1">{position.responsibilities}</p>
                    </div>
                  )}
                  {position.authorities && (
                    <div>
                      <span className="font-medium text-gray-700">Yetkiler:</span>
                      <p className="text-gray-600 mt-1">{position.authorities}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPosition(position)}
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
            </div>
          </div>
        ))}
      </div>
    );
  };

  const canEdit = profile?.role === 'admin' || profile?.role === 'ic_coordinator' || profile?.role === 'super_admin';

  if (loading) {
    return <div className="p-6 text-center">Yükleniyor...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organizasyon Yönetimi</h1>
            <p className="text-sm text-gray-600">Organizasyon Şeması, Ünvanlar ve Yetki Matrisi</p>
            {selectedPlan && (
              <p className="text-xs text-gray-500">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
            )}
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              setEditingPosition(null);
              resetPositionForm();
              setShowPositionForm(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Pozisyon
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'hierarchy'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Organizasyon Şeması
              </div>
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'positions'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ünvan Listesi
              </div>
            </button>
            <button
              onClick={() => setActiveTab('authorities')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'authorities'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Yetki Matrisi
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'hierarchy' && (
            <div>
              {positions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Henüz pozisyon eklenmemiş. Organizasyon şemasını oluşturmak için pozisyon ekleyin.
                </div>
              ) : (
                <div>
                  {positions.map(position => renderPositionNode(position))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'positions' && renderPositionsList()}

          {activeTab === 'authorities' && (
            <div className="text-center py-12 text-gray-500">
              Yetki matrisi özelliği yakında eklenecek...
            </div>
          )}
        </div>
      </div>

      {showPositionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingPosition ? 'Pozisyon Düzenle' : 'Yeni Pozisyon Ekle'}
              </h2>

              <form onSubmit={handleSubmitPosition} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ünvan/Pozisyon Adı *</label>
                  <input
                    type="text"
                    required
                    value={positionForm.title}
                    onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seviye *</label>
                    <select
                      required
                      value={positionForm.level}
                      onChange={(e) => setPositionForm({ ...positionForm, level: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Üst Pozisyon</label>
                    <select
                      value={positionForm.parent_position_id}
                      onChange={(e) => setPositionForm({ ...positionForm, parent_position_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Yok (En Üst Seviye)</option>
                      {positions.flatMap(function flatten(pos): Position[] {
                        return [pos, ...(pos.children || []).flatMap(flatten)];
                      }).filter(p => !editingPosition || p.id !== editingPosition.id).map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                  <textarea
                    value={positionForm.description}
                    onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sorumluluklar</label>
                  <textarea
                    value={positionForm.responsibilities}
                    onChange={(e) => setPositionForm({ ...positionForm, responsibilities: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Bu pozisyonun sorumlulukları..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yetkiler</label>
                  <textarea
                    value={positionForm.authorities}
                    onChange={(e) => setPositionForm({ ...positionForm, authorities: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Bu pozisyonun yetkileri..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aranan Nitelikler</label>
                  <textarea
                    value={positionForm.qualifications}
                    onChange={(e) => setPositionForm({ ...positionForm, qualifications: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Eğitim, deneyim, sertifikalar..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPositionForm(false);
                      setEditingPosition(null);
                      resetPositionForm();
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
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
