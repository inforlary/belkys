import { useState, useEffect } from 'react';
import { Plus, Search, Filter, FileText, Clock, CheckCircle, FileEdit, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { WorkflowProcess, WorkflowStatistics, STATUS_LABELS, STATUS_COLORS } from '../types/workflow';
import Modal from '../components/ui/Modal';

export default function WorkflowList() {
  const { navigate } = useLocation();
  const { user, profile } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowProcess[]>([]);
  const [statistics, setStatistics] = useState<WorkflowStatistics>({
    total: 0,
    approved: 0,
    pending_approval: 0,
    draft: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowProcess | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, [user]);

  async function fetchWorkflows() {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('workflow_processes')
        .select(`
          *,
          qm_process:qm_processes(
            code,
            name,
            owner_department:departments(name, code)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkflows(data || []);

      const stats: WorkflowStatistics = {
        total: data?.length || 0,
        approved: data?.filter(w => w.status === 'approved').length || 0,
        pending_approval: data?.filter(w => w.status === 'pending_approval').length || 0,
        draft: data?.filter(w => w.status === 'draft').length || 0
      };
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isAdmin = profile?.role?.toLowerCase() === 'admin' || profile?.is_super_admin;

  const handleDeleteClick = (workflow: WorkflowProcess, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkflowToDelete(workflow);
    setShowDeleteModal(true);
  };

  const handleEditClick = (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/workflows/edit/${workflowId}`);
  };

  const handleDelete = async () => {
    if (!workflowToDelete) return;
    try {
      const { error } = await supabase
        .from('workflow_processes')
        .delete()
        .eq('id', workflowToDelete.id);

      if (error) throw error;
      alert('İş akışı başarıyla silindi');
      setShowDeleteModal(false);
      setWorkflowToDelete(null);
      fetchWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Silme işlemi sırasında bir hata oluştu');
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-12 h-12 opacity-20" style={{ color }} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İş Akış Şemaları</h1>
          <p className="text-gray-600 mt-1">İş süreçlerinizi görsel olarak yönetin</p>
        </div>
        <button
          onClick={() => navigate('/workflows/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni Süreç Oluştur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={FileText} label="Toplam Süreç" value={statistics.total} color="#3b82f6" />
        <StatCard icon={CheckCircle} label="Onaylanan" value={statistics.approved} color="#10b981" />
        <StatCard icon={Clock} label="Onay Bekliyor" value={statistics.pending_approval} color="#f59e0b" />
        <StatCard icon={FileEdit} label="Taslak" value={statistics.draft} color="#6b7280" />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Süreç adı veya kodu ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="approved">Onaylanan</option>
              <option value="pending_approval">Onay Bekliyor</option>
              <option value="draft">Taslak</option>
            </select>
          </div>
        </div>

        {filteredWorkflows.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Henüz iş akış şeması bulunmuyor</p>
            <p className="text-gray-400 mb-6">İlk sürecinizi oluşturmak için yukarıdaki butonu kullanın</p>
            <button
              onClick={() => navigate('/workflows/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Yeni Süreç Oluştur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => navigate(`/workflows/${workflow.id}`)}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">{workflow.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[workflow.status]}`}>
                        {STATUS_LABELS[workflow.status]}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                  </div>
                </div>
                {workflow.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{workflow.description}</p>
                )}
                {workflow.qm_process && (
                  <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="text-xs text-blue-900 font-medium mb-1">
                      QM Süreci: {workflow.qm_process.code}
                    </div>
                    {workflow.qm_process.owner_department && (
                      <div className="text-xs text-blue-700">
                        Birim: {workflow.qm_process.owner_department.name}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>Versiyon {workflow.version}</span>
                  <span>{new Date(workflow.created_at).toLocaleDateString('tr-TR')}</span>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => handleEditClick(workflow.id, e)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Düzenle
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(workflow, e)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Sil
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="İş Akışını Sil">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 font-medium">Bu işlem geri alınamaz!</p>
              <p className="text-sm text-red-700 mt-1">
                <strong>{workflowToDelete?.name}</strong> iş akış şeması ve tüm ilişkili veriler kalıcı olarak silinecektir.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Sil
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
