import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit, Trash2, Eye, BarChart3, X, TrendingUp } from 'lucide-react';

interface ProcessCategory {
  id: string;
  name: string;
  description: string | null;
}

interface Process {
  id: string;
  code: string;
  name: string;
  description: string | null;
  purpose: string | null;
  scope: string | null;
  inputs: string | null;
  outputs: string | null;
  resources: string | null;
  status: string;
  category_id: string | null;
  process_owner_id: string | null;
  owner_department_id: string | null;
  related_risks: string[] | null;
  related_goal_id: string | null;
  category: ProcessCategory | null;
  process_owner: { full_name: string } | null;
  owner_department: { name: string } | null;
  related_goal: { code: string; name: string } | null;
  kpis?: ProcessKPI[];
  has_workflow?: boolean;
}

interface ProcessKPI {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  target_value: number | null;
  measurement_frequency: string;
  is_active: boolean;
  responsible: { full_name: string } | null;
  latest_value?: number | null;
}

interface User {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Risk {
  id: string;
  code: string;
  name: string;
  owner_department_id: string | null;
}

interface Goal {
  id: string;
  code: string;
  name: string;
  department_id: string | null;
}

export default function QualityProcesses() {
  const { profile } = useAuth();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [categories, setCategories] = useState<ProcessCategory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showKPIForm, setShowKPIForm] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [viewingProcess, setViewingProcess] = useState<Process | null>(null);
  const [managingKPIProcess, setManagingKPIProcess] = useState<Process | null>(null);
  const [editingKPI, setEditingKPI] = useState<ProcessKPI | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: '',
    owner_department_id: '',
    purpose: '',
    scope: '',
    inputs: '',
    outputs: '',
    resources: '',
    description: '',
    status: 'ACTIVE',
    related_risks: [] as string[],
    related_goal_id: ''
  });
  const [kpiFormData, setKpiFormData] = useState({
    name: '',
    description: '',
    unit: '%',
    target_value: '',
    measurement_frequency: 'MONTHLY',
    responsible_id: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProcesses(),
        loadCategories(),
        loadUsers(),
        loadDepartments(),
        loadRisks(),
        loadGoals()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProcesses = async () => {
    const { data, error } = await supabase
      .from('qm_processes')
      .select(`
        *,
        category:qm_process_categories(id, name, description),
        process_owner:profiles!qm_processes_process_owner_id_fkey(full_name),
        owner_department:departments(name),
        related_goal:goals(code, name)
      `)
      .eq('organization_id', profile?.organization_id)
      .order('code');

    if (error) throw error;

    const processesWithWorkflow = await Promise.all((data || []).map(async (process) => {
      const { data: workflowData } = await supabase
        .rpc('check_process_has_workflow', {
          process_id: process.id,
          org_id: profile?.organization_id
        });

      return {
        ...process,
        has_workflow: workflowData || false
      };
    }));

    setProcesses(processesWithWorkflow);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('qm_process_categories')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('order_index');

    if (error) throw error;
    if (!data || data.length === 0) {
      await createDefaultCategories();
    } else {
      setCategories(data || []);
    }
  };

  const createDefaultCategories = async () => {
    const defaultCategories = [
      { name: 'Ana Hizmet Süreçleri', order_index: 1 },
      { name: 'Yönetim Süreçleri', order_index: 2 },
      { name: 'Destek Süreçleri', order_index: 3 },
      { name: 'İzleme ve Değerlendirme Süreçleri', order_index: 4 },
      { name: 'Operasyonel Süreçler', order_index: 5 }
    ];

    const { data, error } = await supabase
      .from('qm_process_categories')
      .insert(
        defaultCategories.map(cat => ({
          ...cat,
          organization_id: profile?.organization_id
        }))
      )
      .select();

    if (!error && data) {
      setCategories(data);
    }
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', profile?.organization_id)
      .order('full_name');

    if (error) throw error;
    setUsers(data || []);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setDepartments(data || []);
  };

  const loadRisks = async () => {
    const { data, error } = await supabase
      .from('risks')
      .select('id, code, name, owner_department_id')
      .eq('organization_id', profile?.organization_id)
      .order('code');

    if (error) throw error;
    setRisks(data || []);
  };

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('id, code, name, department_id')
      .eq('organization_id', profile?.organization_id)
      .order('code');

    if (error) throw error;
    setGoals(data || []);
  };

  const generateProcessCode = async () => {
    const { data, error } = await supabase
      .rpc('generate_qm_process_code', { org_id: profile?.organization_id });

    if (error) {
      console.error('Error generating code:', error);
      return 'SRC-001';
    }
    return data || 'SRC-001';
  };

  const handleOpenModal = async (process?: Process) => {
    if (process) {
      setEditingProcess(process);
      setFormData({
        code: process.code,
        name: process.name,
        category_id: process.category_id || '',
        owner_department_id: process.owner_department_id || '',
        purpose: process.purpose || '',
        scope: process.scope || '',
        inputs: process.inputs || '',
        outputs: process.outputs || '',
        resources: process.resources || '',
        description: process.description || '',
        status: process.status,
        related_risks: process.related_risks || [],
        related_goal_id: process.related_goal_id || ''
      });
    } else {
      setEditingProcess(null);
      const newCode = await generateProcessCode();
      setFormData({
        code: newCode,
        name: '',
        category_id: '',
        owner_department_id: '',
        purpose: '',
        scope: '',
        inputs: '',
        outputs: '',
        resources: '',
        description: '',
        status: 'ACTIVE',
        related_risks: [],
        related_goal_id: ''
      });
    }
    setShowModal(true);
  };

  const handleSaveProcess = async () => {
    if (!formData.code || !formData.name || !formData.category_id || !formData.owner_department_id) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      const saveData = {
        code: formData.code,
        name: formData.name,
        category_id: formData.category_id,
        owner_department_id: formData.owner_department_id,
        purpose: formData.purpose || null,
        scope: formData.scope || null,
        inputs: formData.inputs || null,
        outputs: formData.outputs || null,
        resources: formData.resources || null,
        description: formData.description || null,
        status: formData.status,
        related_risks: formData.related_risks.length > 0 ? formData.related_risks : null,
        related_goal_id: formData.related_goal_id || null
      };

      if (editingProcess) {
        const { error } = await supabase
          .from('qm_processes')
          .update({
            ...saveData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProcess.id);

        if (error) throw error;
        alert('Süreç güncellendi');
      } else {
        const { error } = await supabase
          .from('qm_processes')
          .insert({
            ...saveData,
            organization_id: profile?.organization_id,
            created_by: profile?.id
          });

        if (error) throw error;
        alert('Süreç başarıyla eklendi');
      }

      setShowModal(false);
      loadProcesses();
    } catch (error: any) {
      console.error('Error saving process:', error);
      alert('İşlem sırasında hata oluştu: ' + error.message);
    }
  };

  const handleDelete = async (process: Process) => {
    if (!confirm(`"${process.code} - ${process.name}" sürecini silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz. Sürece bağlı KPI'lar da silinecektir.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('qm_processes')
        .delete()
        .eq('id', process.id);

      if (error) throw error;
      alert('Süreç silindi');
      loadProcesses();
    } catch (error: any) {
      console.error('Error deleting process:', error);
      alert('Süreç silinirken hata oluştu: ' + error.message);
    }
  };

  const handleViewProcess = async (process: Process) => {
    const { data: kpis } = await supabase
      .from('qm_process_kpis')
      .select(`
        *,
        responsible:profiles!qm_process_kpis_responsible_id_fkey(full_name)
      `)
      .eq('process_id', process.id)
      .order('code');

    setViewingProcess({ ...process, kpis: kpis || [] });
    setShowDetailModal(true);
  };

  const handleManageKPIs = async (process: Process) => {
    const { data: kpis } = await supabase
      .from('qm_process_kpis')
      .select(`
        *,
        responsible:profiles!qm_process_kpis_responsible_id_fkey(full_name)
      `)
      .eq('process_id', process.id)
      .order('code');

    setManagingKPIProcess({ ...process, kpis: kpis || [] });
    setShowKPIModal(true);
  };

  const handleOpenKPIForm = (kpi?: ProcessKPI) => {
    if (kpi) {
      setEditingKPI(kpi);
      setKpiFormData({
        name: kpi.name,
        description: kpi.description || '',
        unit: kpi.unit || '%',
        target_value: kpi.target_value?.toString() || '',
        measurement_frequency: kpi.measurement_frequency,
        responsible_id: kpi.responsible?.id || ''
      });
    } else {
      setEditingKPI(null);
      setKpiFormData({
        name: '',
        description: '',
        unit: '%',
        target_value: '',
        measurement_frequency: 'MONTHLY',
        responsible_id: ''
      });
    }
    setShowKPIForm(true);
  };

  const handleSaveKPI = async () => {
    if (!kpiFormData.name || !kpiFormData.unit) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      if (editingKPI) {
        const { error } = await supabase
          .from('qm_process_kpis')
          .update({
            name: kpiFormData.name,
            description: kpiFormData.description || null,
            unit: kpiFormData.unit,
            target_value: kpiFormData.target_value ? parseFloat(kpiFormData.target_value) : null,
            measurement_frequency: kpiFormData.measurement_frequency,
            responsible_id: kpiFormData.responsible_id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingKPI.id);

        if (error) throw error;
        alert('KPI güncellendi');
      } else {
        const kpiCount = managingKPIProcess?.kpis?.length || 0;
        const newCode = `KPI-${String(kpiCount + 1).padStart(2, '0')}`;

        const { error } = await supabase
          .from('qm_process_kpis')
          .insert({
            process_id: managingKPIProcess?.id,
            code: newCode,
            name: kpiFormData.name,
            description: kpiFormData.description || null,
            unit: kpiFormData.unit,
            target_value: kpiFormData.target_value ? parseFloat(kpiFormData.target_value) : null,
            measurement_frequency: kpiFormData.measurement_frequency,
            responsible_id: kpiFormData.responsible_id || null
          });

        if (error) throw error;
        alert('KPI başarıyla eklendi');
      }

      setShowKPIForm(false);
      if (managingKPIProcess) {
        handleManageKPIs(managingKPIProcess);
      }
    } catch (error: any) {
      console.error('Error saving KPI:', error);
      alert('İşlem sırasında hata oluştu: ' + error.message);
    }
  };

  const handleDeleteKPI = async (kpiId: string) => {
    if (!confirm('Bu KPI\'ı silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('qm_process_kpis')
        .delete()
        .eq('id', kpiId);

      if (error) throw error;
      alert('KPI silindi');
      if (managingKPIProcess) {
        handleManageKPIs(managingKPIProcess);
      }
    } catch (error: any) {
      console.error('Error deleting KPI:', error);
      alert('KPI silinirken hata oluştu: ' + error.message);
    }
  };

  const filteredProcesses = processes.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category_id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      ACTIVE: { label: 'Aktif', color: 'bg-green-100 text-green-800' },
      DRAFT: { label: 'Taslak', color: 'bg-yellow-100 text-yellow-800' },
      INACTIVE: { label: 'Pasif', color: 'bg-gray-100 text-gray-800' }
    };
    const { label, color } = statusMap[status as keyof typeof statusMap] || statusMap.ACTIVE;
    return <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${color}`}>{label}</span>;
  };

  const filteredRisks = risks.filter(risk =>
    !formData.owner_department_id || risk.owner_department_id === formData.owner_department_id
  );

  const filteredGoals = goals.filter(goal =>
    !formData.owner_department_id || goal.department_id === formData.owner_department_id
  );

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

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
          <h1 className="text-3xl font-bold text-gray-900">Süreç Yönetimi</h1>
          <p className="mt-2 text-gray-600">Kalite süreçleri tanımlama ve yönetimi</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Süreç
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Süreç ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kod
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Süreç Adı
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategori
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sorumlu Birim
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProcesses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Süreç bulunamadı
                </td>
              </tr>
            ) : (
              filteredProcesses.map((process) => (
                <tr key={process.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {process.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {process.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {process.category?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {process.owner_department?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(process.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewProcess(process)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Görüntüle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleManageKPIs(process)}
                        className="text-purple-600 hover:text-purple-700"
                        title="KPI Yönet"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenModal(process)}
                            className="text-gray-600 hover:text-gray-700"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(process)}
                            className="text-red-600 hover:text-red-700"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProcess ? 'Süreç Düzenle' : 'Yeni Süreç Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Süreç Kodu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="SRC-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Süreç Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçiniz...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sorumlu Birim <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.owner_department_id}
                    onChange={(e) => setFormData({ ...formData, owner_department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçiniz...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durum
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="DRAFT">Taslak</option>
                  <option value="INACTIVE">Pasif</option>
                </select>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">TANIM</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Süreç Amacı
                    </label>
                    <textarea
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kapsam
                    </label>
                    <textarea
                      value={formData.scope}
                      onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">GİRDİ / ÇIKTI</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Girdiler
                    </label>
                    <textarea
                      value={formData.inputs}
                      onChange={(e) => setFormData({ ...formData, inputs: e.target.value })}
                      rows={3}
                      placeholder="Her satıra bir girdi yazın..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Çıktılar
                    </label>
                    <textarea
                      value={formData.outputs}
                      onChange={(e) => setFormData({ ...formData, outputs: e.target.value })}
                      rows={3}
                      placeholder="Her satıra bir çıktı yazın..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">KAYNAKLAR</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kaynaklar
                  </label>
                  <textarea
                    value={formData.resources}
                    onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
                    rows={2}
                    placeholder="Personel, ekipman, yazılım vb."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">BAĞLANTILAR</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      İlgili Riskler
                      {!formData.owner_department_id && (
                        <span className="text-xs text-gray-500 ml-2">(Önce sorumlu birim seçiniz)</span>
                      )}
                    </label>
                    <select
                      multiple
                      value={formData.related_risks}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setFormData({ ...formData, related_risks: selected });
                      }}
                      disabled={!formData.owner_department_id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px]"
                    >
                      {filteredRisks.map(risk => (
                        <option key={risk.id} value={risk.id}>
                          {risk.code} - {risk.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd tuşu ile çoklu seçim yapabilirsiniz</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stratejik Hedef
                      {!formData.owner_department_id && (
                        <span className="text-xs text-gray-500 ml-2">(Önce sorumlu birim seçiniz)</span>
                      )}
                    </label>
                    <select
                      value={formData.related_goal_id}
                      onChange={(e) => setFormData({ ...formData, related_goal_id: e.target.value })}
                      disabled={!formData.owner_department_id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seçiniz...</option>
                      {filteredGoals.map(goal => (
                        <option key={goal.id} value={goal.id}>
                          {goal.code} - {goal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {editingProcess && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">OTOMATİK BİLGİLER</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">İş Akışı Durumu:</span>
                      {editingProcess.has_workflow ? (
                        <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-green-800 bg-green-100 rounded-full">
                          ✓ Var
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
                          ✗ Yok
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveProcess}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && viewingProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {viewingProcess.code} - {viewingProcess.name}
                </h2>
                {getStatusBadge(viewingProcess.status)}
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">TEMEL BİLGİLER</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Kategori:</span>
                    <span className="ml-2 text-gray-900">{viewingProcess.category?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Sorumlu Birim:</span>
                    <span className="ml-2 text-gray-900">{viewingProcess.owner_department?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">İş Akışı Durumu:</span>
                    {viewingProcess.has_workflow ? (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        ✓ Var
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                        ✗ Yok
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Durum:</span>
                    <span className="ml-2">{getStatusBadge(viewingProcess.status)}</span>
                  </div>
                </div>
              </div>

              {(viewingProcess.related_goal_id || (viewingProcess.related_risks && viewingProcess.related_risks.length > 0)) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">BAĞLANTILAR</h3>
                  <div className="space-y-3 text-sm">
                    {viewingProcess.related_goal_id && viewingProcess.related_goal && (
                      <div>
                        <span className="font-medium text-gray-700">Stratejik Hedef:</span>
                        <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded">
                          <span className="text-blue-900 font-medium">{viewingProcess.related_goal.code}</span>
                          <span className="text-blue-800 ml-2">{viewingProcess.related_goal.name}</span>
                        </div>
                      </div>
                    )}
                    {viewingProcess.related_risks && viewingProcess.related_risks.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">İlgili Riskler:</span>
                        <div className="mt-1 space-y-1">
                          {viewingProcess.related_risks.map((riskId, idx) => {
                            const risk = risks.find(r => r.id === riskId);
                            return risk ? (
                              <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded">
                                <span className="text-red-900 font-medium">{risk.code}</span>
                                <span className="text-red-800 ml-2">{risk.name}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewingProcess.purpose && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AMAÇ</h3>
                  <p className="text-gray-700">{viewingProcess.purpose}</p>
                </div>
              )}

              {viewingProcess.scope && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">KAPSAM</h3>
                  <p className="text-gray-700">{viewingProcess.scope}</p>
                </div>
              )}

              {(viewingProcess.inputs || viewingProcess.outputs) && (
                <div className="grid grid-cols-2 gap-6">
                  {viewingProcess.inputs && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">GİRDİLER</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {viewingProcess.inputs.split('\n').filter(i => i.trim()).map((input, idx) => (
                          <li key={idx}>{input.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewingProcess.outputs && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">ÇIKTILAR</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {viewingProcess.outputs.split('\n').filter(o => o.trim()).map((output, idx) => (
                          <li key={idx}>{output.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {viewingProcess.resources && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">KAYNAKLAR</h3>
                  <p className="text-gray-700">{viewingProcess.resources}</p>
                </div>
              )}

              {viewingProcess.kpis && viewingProcess.kpis.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">PERFORMANS GÖSTERGELERİ (KPI)</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gösterge</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hedef</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {viewingProcess.kpis.map(kpi => (
                          <tr key={kpi.id}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{kpi.code}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{kpi.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{kpi.target_value || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{kpi.unit || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenModal(viewingProcess);
                  }}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Düzenle
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleManageKPIs(viewingProcess);
                }}
                className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                KPI Yönet
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {showKPIModal && managingKPIProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                KPI Yönetimi - {managingKPIProcess.code} {managingKPIProcess.name}
              </h2>
              <button onClick={() => setShowKPIModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">KPI Listesi</h3>
                {isAdmin && (
                  <button
                    onClick={() => handleOpenKPIForm()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni KPI
                  </button>
                )}
              </div>

              {showKPIForm && (
                <div className="mb-6 p-4 border-2 border-blue-200 bg-blue-50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      KPI Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={kpiFormData.name}
                      onChange={(e) => setKpiFormData({ ...kpiFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Açıklama
                    </label>
                    <input
                      type="text"
                      value={kpiFormData.description}
                      onChange={(e) => setKpiFormData({ ...kpiFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Birim <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={kpiFormData.unit}
                        onChange={(e) => setKpiFormData({ ...kpiFormData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="%">%</option>
                        <option value="Adet">Adet</option>
                        <option value="Gün">Gün</option>
                        <option value="TL">TL</option>
                        <option value="Saat">Saat</option>
                        <option value="Puan">Puan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hedef Değer
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={kpiFormData.target_value}
                        onChange={(e) => setKpiFormData({ ...kpiFormData, target_value: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ölçüm Sıklığı
                      </label>
                      <select
                        value={kpiFormData.measurement_frequency}
                        onChange={(e) => setKpiFormData({ ...kpiFormData, measurement_frequency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="DAILY">Günlük</option>
                        <option value="WEEKLY">Haftalık</option>
                        <option value="MONTHLY">Aylık</option>
                        <option value="QUARTERLY">Çeyrek Yıl</option>
                        <option value="YEARLY">Yıllık</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowKPIForm(false)}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSaveKPI}
                      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      {editingKPI ? 'Güncelle' : 'Ekle'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {(!managingKPIProcess.kpis || managingKPIProcess.kpis.length === 0) ? (
                  <div className="text-center py-8 text-gray-500">
                    Henüz KPI eklenmemiş
                  </div>
                ) : (
                  managingKPIProcess.kpis.map(kpi => (
                    <div key={kpi.id} className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{kpi.code} - {kpi.name}</h4>
                          {kpi.description && (
                            <p className="text-sm text-gray-600 mt-1">{kpi.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-700">
                            <span>Hedef: <strong>{kpi.target_value || '-'}</strong></span>
                            <span>Birim: <strong>{kpi.unit || '-'}</strong></span>
                            <span>Sıklık: <strong>
                              {kpi.measurement_frequency === 'DAILY' ? 'Günlük' :
                               kpi.measurement_frequency === 'WEEKLY' ? 'Haftalık' :
                               kpi.measurement_frequency === 'MONTHLY' ? 'Aylık' :
                               kpi.measurement_frequency === 'QUARTERLY' ? 'Çeyrek Yıl' :
                               'Yıllık'}
                            </strong></span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleOpenKPIForm(kpi)}
                              className="text-gray-600 hover:text-gray-700"
                              title="Düzenle"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteKPI(kpi.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end border-t">
              <button
                onClick={() => setShowKPIModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
