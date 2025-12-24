import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Building2, AlertTriangle, Briefcase, ClipboardList, Trash2 } from 'lucide-react';
import type {
  Collaboration,
  CollaborationPartner,
  CollaborationRisk,
  CollaborationProject,
  CollaborationFinding,
  Department
} from '../types/database';

export default function Collaborations() {
  const { user } = useAuth();
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCollaboration, setSelectedCollaboration] = useState<Collaboration | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [partners, setPartners] = useState<(CollaborationPartner & { department: Department })[]>([]);
  const [risks, setRisks] = useState<CollaborationRisk[]>([]);
  const [projects, setProjects] = useState<CollaborationProject[]>([]);
  const [findings, setFindings] = useState<CollaborationFinding[]>([]);

  const [formData, setFormData] = useState({
    responsible_department_id: '',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planning' as const
  });

  useEffect(() => {
    if (user) {
      fetchDepartments();
      fetchCollaborations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCollaboration) {
      fetchCollaborationDetails(selectedCollaboration.id);
    }
  }, [selectedCollaboration]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchCollaborations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('collaborations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCollaborations(data);
    }
    setLoading(false);
  };

  const fetchCollaborationDetails = async (collaborationId: string) => {
    const { data: partnersData } = await supabase
      .from('collaboration_partners')
      .select('*, department:departments(*)')
      .eq('collaboration_id', collaborationId);

    const { data: risksData } = await supabase
      .from('collaboration_risks')
      .select('*')
      .eq('collaboration_id', collaborationId)
      .order('created_at', { ascending: false });

    const { data: projectsData } = await supabase
      .from('collaboration_projects')
      .select('*')
      .eq('collaboration_id', collaborationId)
      .order('created_at', { ascending: false });

    const { data: findingsData } = await supabase
      .from('collaboration_findings')
      .select('*')
      .eq('collaboration_id', collaborationId)
      .order('created_at', { ascending: false });

    if (partnersData) setPartners(partnersData as any);
    if (risksData) setRisks(risksData);
    if (projectsData) setProjects(projectsData);
    if (findingsData) setFindings(findingsData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data, error } = await supabase
      .from('collaborations')
      .insert([{
        ...formData,
        organization_id: user.id,
        created_by: user.id
      }])
      .select()
      .single();

    if (!error && data) {
      setCollaborations([data, ...collaborations]);
      setShowModal(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      responsible_department_id: '',
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'planning'
    });
  };

  const deleteCollaboration = async (id: string) => {
    if (!confirm('Bu işbirliği kaydını silmek istediğinize emin misiniz?')) return;

    const { error } = await supabase
      .from('collaborations')
      .delete()
      .eq('id', id);

    if (!error) {
      setCollaborations(collaborations.filter(c => c.id !== id));
      if (selectedCollaboration?.id === id) {
        setSelectedCollaboration(null);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      planning: 'bg-gray-100 text-gray-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    const labels = {
      planning: 'Planlanıyor',
      active: 'Aktif',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return <div className="p-6">Yükleniyor...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Birimler Arası İşbirliği</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Yeni İşbirliği
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">İşbirliği Kayıtları</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {collaborations.map((collab) => {
                const dept = departments.find(d => d.id === collab.responsible_department_id);
                return (
                  <div
                    key={collab.id}
                    onClick={() => setSelectedCollaboration(collab)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedCollaboration?.id === collab.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{collab.title}</h3>
                      {getStatusBadge(collab.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{dept?.name}</p>
                    {collab.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{collab.description}</p>
                    )}
                  </div>
                );
              })}
              {collaborations.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Henüz işbirliği kaydı yok
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedCollaboration ? (
            <CollaborationDetails
              collaboration={selectedCollaboration}
              departments={departments}
              partners={partners}
              risks={risks}
              projects={projects}
              findings={findings}
              onRefresh={() => fetchCollaborationDetails(selectedCollaboration.id)}
              onDelete={deleteCollaboration}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              Detayları görmek için bir işbirliği kaydı seçin
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Yeni İşbirliği</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sorumlu Birim/Müdürlük
                </label>
                <select
                  required
                  value={formData.responsible_department_id}
                  onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">Seçiniz</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="planning">Planlanıyor</option>
                  <option value="active">Aktif</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal Edildi</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface CollaborationDetailsProps {
  collaboration: Collaboration;
  departments: Department[];
  partners: (CollaborationPartner & { department: Department })[];
  risks: CollaborationRisk[];
  projects: CollaborationProject[];
  findings: CollaborationFinding[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
}

function CollaborationDetails({
  collaboration,
  departments,
  partners,
  risks,
  projects,
  findings,
  onRefresh,
  onDelete
}: CollaborationDetailsProps) {
  const [activeTab, setActiveTab] = useState<'partners' | 'risks' | 'projects' | 'findings'>('partners');

  const dept = departments.find(d => d.id === collaboration.responsible_department_id);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{collaboration.title}</h2>
            <p className="text-gray-600 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {dept?.name}
            </p>
          </div>
          <button
            onClick={() => onDelete(collaboration.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        {collaboration.description && (
          <p className="text-gray-700 mb-4">{collaboration.description}</p>
        )}
        <div className="flex gap-4 text-sm text-gray-600">
          {collaboration.start_date && (
            <span>Başlangıç: {new Date(collaboration.start_date).toLocaleDateString('tr-TR')}</span>
          )}
          {collaboration.end_date && (
            <span>Bitiş: {new Date(collaboration.end_date).toLocaleDateString('tr-TR')}</span>
          )}
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-4 px-6">
          <button
            onClick={() => setActiveTab('partners')}
            className={`py-3 px-2 border-b-2 font-medium ${
              activeTab === 'partners'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            İşbirlikçi Birimler ({partners.length})
          </button>
          <button
            onClick={() => setActiveTab('risks')}
            className={`py-3 px-2 border-b-2 font-medium ${
              activeTab === 'risks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Riskler ({risks.length})
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-3 px-2 border-b-2 font-medium ${
              activeTab === 'projects'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Faaliyet/Projeler ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('findings')}
            className={`py-3 px-2 border-b-2 font-medium ${
              activeTab === 'findings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tespit/İhtiyaçlar ({findings.length})
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'partners' && (
          <PartnersSection
            collaborationId={collaboration.id}
            partners={partners}
            departments={departments}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'risks' && (
          <RisksSection
            collaborationId={collaboration.id}
            risks={risks}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'projects' && (
          <ProjectsSection
            collaborationId={collaboration.id}
            projects={projects}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'findings' && (
          <FindingsSection
            collaborationId={collaboration.id}
            findings={findings}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
}

function PartnersSection({
  collaborationId,
  partners,
  departments,
  onRefresh
}: {
  collaborationId: string;
  partners: (CollaborationPartner & { department: Department })[];
  departments: Department[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('collaboration_partners')
      .insert([{
        collaboration_id: collaborationId,
        department_id: departmentId,
        role: role || null
      }]);

    if (!error) {
      setShowForm(false);
      setDepartmentId('');
      setRole('');
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('collaboration_partners')
      .delete()
      .eq('id', id);

    if (!error) {
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">İşbirlikçi Birimler</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Birim Ekle
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Seçiniz</option>
              {departments
                .filter(d => !partners.some(p => p.department_id === d.id))
                .map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol/Görev</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Opsiyonel"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Ekle
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {partners.map((partner) => (
          <div key={partner.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{partner.department.name}</p>
              {partner.role && <p className="text-sm text-gray-600">{partner.role}</p>}
            </div>
            <button
              onClick={() => handleDelete(partner.id)}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {partners.length === 0 && (
          <p className="text-gray-500 text-center py-4">Henüz işbirlikçi birim eklenmedi</p>
        )}
      </div>
    </div>
  );
}

function RisksSection({
  collaborationId,
  risks,
  onRefresh
}: {
  collaborationId: string;
  risks: CollaborationRisk[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    severity: 'medium' as const,
    mitigation_plan: '',
    status: 'identified' as const
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('collaboration_risks')
      .insert([{
        collaboration_id: collaborationId,
        ...formData
      }]);

    if (!error) {
      setShowForm(false);
      setFormData({
        description: '',
        severity: 'medium',
        mitigation_plan: '',
        status: 'identified'
      });
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('collaboration_risks')
      .delete()
      .eq('id', id);

    if (!error) {
      onRefresh();
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    const labels = {
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      critical: 'Kritik'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[severity as keyof typeof styles]}`}>
        {labels[severity as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Riskler</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Risk Ekle
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Açıklaması</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Önem Derecesi</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="identified">Tespit Edildi</option>
                <option value="monitoring">İzleniyor</option>
                <option value="mitigated">Azaltıldı</option>
                <option value="realized">Gerçekleşti</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Azaltma Planı</label>
            <textarea
              value={formData.mitigation_plan}
              onChange={(e) => setFormData({ ...formData, mitigation_plan: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Ekle
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {risks.map((risk) => (
          <div key={risk.id} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  {getSeverityBadge(risk.severity)}
                </div>
                <p className="text-gray-900 mb-2">{risk.description}</p>
                {risk.mitigation_plan && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Azaltma Planı:</span> {risk.mitigation_plan}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(risk.id)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {risks.length === 0 && (
          <p className="text-gray-500 text-center py-4">Henüz risk eklenmedi</p>
        )}
      </div>
    </div>
  );
}

function ProjectsSection({
  collaborationId,
  projects,
  onRefresh
}: {
  collaborationId: string;
  projects: CollaborationProject[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'activity' as const,
    start_date: '',
    end_date: '',
    budget: '',
    status: 'planned' as const
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('collaboration_projects')
      .insert([{
        collaboration_id: collaborationId,
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null
      }]);

    if (!error) {
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        type: 'activity',
        start_date: '',
        end_date: '',
        budget: '',
        status: 'planned'
      });
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('collaboration_projects')
      .delete()
      .eq('id', id);

    if (!error) {
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Faaliyet ve Projeler</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Ekle
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="activity">Faaliyet</option>
                <option value="project">Proje</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="planned">Planlandı</option>
                <option value="ongoing">Devam Ediyor</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal Edildi</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bütçe (₺)</label>
              <input
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Ekle
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {projects.map((project) => (
          <div key={project.id} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-600">
                    {project.type === 'activity' ? 'Faaliyet' : 'Proje'}
                  </span>
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{project.title}</h4>
                {project.description && (
                  <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                )}
                <div className="flex gap-4 text-xs text-gray-500">
                  {project.start_date && (
                    <span>Başlangıç: {new Date(project.start_date).toLocaleDateString('tr-TR')}</span>
                  )}
                  {project.budget && (
                    <span>Bütçe: {project.budget.toLocaleString('tr-TR')} ₺</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(project.id)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-gray-500 text-center py-4">Henüz faaliyet/proje eklenmedi</p>
        )}
      </div>
    </div>
  );
}

function FindingsSection({
  collaborationId,
  findings,
  onRefresh
}: {
  collaborationId: string;
  findings: CollaborationFinding[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'finding' as const,
    title: '',
    description: '',
    priority: 'medium' as const,
    status: 'identified' as const,
    action_taken: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('collaboration_findings')
      .insert([{
        collaboration_id: collaborationId,
        ...formData
      }]);

    if (!error) {
      setShowForm(false);
      setFormData({
        type: 'finding',
        title: '',
        description: '',
        priority: 'medium',
        status: 'identified',
        action_taken: ''
      });
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('collaboration_findings')
      .delete()
      .eq('id', id);

    if (!error) {
      onRefresh();
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    const labels = {
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      urgent: 'Acil'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[priority as keyof typeof styles]}`}>
        {labels[priority as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Tespitler ve İhtiyaçlar</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Ekle
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="finding">Tespit</option>
                <option value="need">İhtiyaç</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="identified">Tespit Edildi</option>
                <option value="under_review">İnceleniyor</option>
                <option value="addressed">Ele Alındı</option>
                <option value="closed">Kapatıldı</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alınan Aksiyon</label>
            <textarea
              value={formData.action_taken}
              onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Ekle
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {findings.map((finding) => (
          <div key={finding.id} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-gray-600">
                    {finding.type === 'finding' ? 'Tespit' : 'İhtiyaç'}
                  </span>
                  {getPriorityBadge(finding.priority)}
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{finding.title}</h4>
                <p className="text-sm text-gray-600 mb-2">{finding.description}</p>
                {finding.action_taken && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Alınan Aksiyon:</span> {finding.action_taken}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(finding.id)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {findings.length === 0 && (
          <p className="text-gray-500 text-center py-4">Henüz tespit/ihtiyaç eklenmedi</p>
        )}
      </div>
    </div>
  );
}
