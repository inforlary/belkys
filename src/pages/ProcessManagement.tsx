import { useState, useEffect } from 'react';
import { Activity, Plus, Edit2, Trash2, ChevronDown, ChevronRight, MapPin, AlertCircle, Save, X, Link as LinkIcon, Target, Network } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import ProcessFlowDiagram from '../components/process-flow/ProcessFlowDiagram';

interface Process {
  id: string;
  code: string;
  name: string;
  description: string;
  department_id: string;
  department_name?: string;
  owner_user_id: string;
  owner_name?: string;
  process_category: string;
  is_critical: boolean;
  status: 'draft' | 'active' | 'under_review' | 'archived';
  kiks_standard_id?: string;
  kiks_standard_title?: string;
  step_count?: number;
  activity_count?: number;
  risk_count?: number;
}

interface ProcessStep {
  id: string;
  process_id: string;
  step_number: number;
  step_name: string;
  step_description: string;
  responsible_role: string;
  responsible_user_id: string;
  responsible_user_name?: string;
  inputs: string;
  outputs: string;
  tools_used: string;
  estimated_duration: string;
}

const STATUS_LABELS = {
  draft: 'Taslak',
  active: 'Aktif',
  under_review: 'İncelemede',
  archived: 'Arşiv'
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-red-100 text-red-800'
};

export default function ProcessManagement() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [unassignedProcesses, setUnassignedProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [kiksStandards, setKiksStandards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showFlowDiagram, setShowFlowDiagram] = useState(false);
  const [showUnassignedModal, setShowUnassignedModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
    owner_user_id: '',
    process_category: '',
    kiks_standard_id: '',
    is_critical: false,
    status: 'draft' as const
  });

  const [stepFormData, setStepFormData] = useState({
    step_number: 1,
    step_name: '',
    step_description: '',
    responsible_role: '',
    responsible_user_id: '',
    inputs: '',
    outputs: '',
    tools_used: '',
    estimated_duration: '',
    step_type: 'process' as 'process' | 'decision' | 'parallel_start' | 'parallel_end' | 'subprocess',
    is_critical_control_point: false,
    parallel_group: null as number | null,
    next_step_condition: '',
    swim_lane: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      if (selectedPlanId) {
        loadData();
      } else {
        loadUnassignedProcesses();
      }
    }
  }, [profile?.organization_id, selectedPlanId]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      await Promise.all([
        loadProcesses(),
        loadUnassignedProcesses(),
        loadDepartments(),
        loadUsers(),
        loadKiksStandards()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadUnassignedProcesses = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('ic_processes')
        .select(`
          *,
          departments(name),
          profiles!ic_processes_owner_user_id_fkey(full_name),
          ic_kiks_main_standards(code, title)
        `)
        .eq('organization_id', profile.organization_id)
        .is('ic_plan_id', null)
        .order('code', { ascending: true });

      if (error) throw error;

      const processesData = (data || []).map(process => ({
        ...process,
        department_name: process.departments?.name,
        owner_name: process.profiles?.full_name,
        kiks_standard_title: process.ic_kiks_main_standards
          ? `${process.ic_kiks_main_standards.code} - ${process.ic_kiks_main_standards.title}`
          : undefined
      }));

      setUnassignedProcesses(processesData);
    } catch (error) {
      console.error('Plansız süreçler yüklenirken hata:', error);
    }
  };

  const loadProcesses = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_processes')
        .select(`
          *,
          departments(name),
          profiles!ic_processes_owner_user_id_fkey(full_name),
          ic_kiks_main_standards(code, title)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('code', { ascending: true });

      if (error) throw error;

      const processesWithCounts = await Promise.all(
        (data || []).map(async (process) => {
          const [stepsResult, activitiesResult, risksResult] = await Promise.all([
            supabase
              .from('ic_process_steps')
              .select('*', { count: 'exact', head: true })
              .eq('process_id', process.id),
            supabase
              .from('ic_activity_process_mappings')
              .select('*', { count: 'exact', head: true })
              .eq('process_id', process.id),
            supabase
              .from('ic_risks')
              .select('*', { count: 'exact', head: true })
              .eq('process_id', process.id)
          ]);

          return {
            ...process,
            department_name: process.departments?.name,
            owner_name: process.profiles?.full_name,
            kiks_standard_title: process.ic_kiks_main_standards ? `${process.ic_kiks_main_standards.code} - ${process.ic_kiks_main_standards.title}` : undefined,
            step_count: stepsResult.count || 0,
            activity_count: activitiesResult.count || 0,
            risk_count: risksResult.count || 0
          };
        })
      );

      setProcesses(processesWithCounts);
    } catch (error) {
      console.error('Süreçler yüklenirken hata:', error);
    }
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

  const loadKiksStandards = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_kiks_sub_standards')
        .select(`
          id,
          code,
          title,
          main_standard_id,
          ic_kiks_main_standards!inner(
            code,
            ic_kiks_categories(name)
          )
        `)
        .or(`ic_plan_id.is.null,ic_plan_id.eq.${selectedPlanId}`)
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        code: item.code,
        title: `${item.code} - ${item.title}`,
        component: item.ic_kiks_main_standards?.ic_kiks_categories?.name || ''
      })).sort((a, b) => {
        const parseCode = (code: string) => {
          const match = code.match(/([A-ZİÖÜŞĞÇ\s]+)\s*(\d+)\.(\d+)/);
          if (match) {
            return {
              prefix: match[1].trim(),
              major: parseInt(match[2]),
              minor: parseInt(match[3])
            };
          }
          return { prefix: code, major: 0, minor: 0 };
        };

        const aCode = parseCode(a.code);
        const bCode = parseCode(b.code);

        if (aCode.prefix !== bCode.prefix) {
          return aCode.prefix.localeCompare(bCode.prefix, 'tr');
        }
        if (aCode.major !== bCode.major) {
          return aCode.major - bCode.major;
        }
        return aCode.minor - bCode.minor;
      });

      setKiksStandards(formattedData);
    } catch (error) {
      console.error('KİKS genel şartları yüklenirken hata:', error);
    }
  };

  const loadProcessSteps = async (processId: string) => {
    try {
      const { data, error } = await supabase
        .from('ic_process_steps')
        .select(`
          *,
          profiles!ic_process_steps_responsible_user_id_fkey(full_name)
        `)
        .eq('process_id', processId)
        .order('step_number', { ascending: true });

      if (error) throw error;

      const steps = (data || []).map(step => ({
        ...step,
        responsible_user_name: step.profiles?.full_name
      }));

      setProcessSteps(steps);
      return steps;
    } catch (error) {
      console.error('Süreç adımları yüklenirken hata:', error);
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const dataToSave = {
        ...formData,
        department_id: formData.department_id || null,
        owner_user_id: formData.owner_user_id || null,
        kiks_standard_id: formData.kiks_standard_id || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('ic_processes')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ic_processes')
          .insert({
            ...dataToSave,
            organization_id: profile.organization_id,
            ic_plan_id: selectedPlanId
          });

        if (error) throw error;
      }

      resetForm();
      loadProcesses();
    } catch (error: any) {
      console.error('Süreç kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess) return;

    try {
      const stepDataToSave = {
        ...stepFormData,
        responsible_user_id: stepFormData.responsible_user_id || null,
      };

      const { error } = await supabase
        .from('ic_process_steps')
        .insert({
          ...stepDataToSave,
          process_id: selectedProcess.id,
          organization_id: profile?.organization_id,
          ic_plan_id: selectedPlanId
        });

      if (error) throw error;

      const updatedSteps = await loadProcessSteps(selectedProcess.id);
      await loadProcesses();

      const maxStepNumber = updatedSteps.length > 0
        ? Math.max(...updatedSteps.map(s => s.step_number))
        : 0;

      setStepFormData({
        step_number: maxStepNumber + 1,
        step_name: '',
        step_description: '',
        responsible_role: '',
        responsible_user_id: '',
        inputs: '',
        outputs: '',
        tools_used: '',
        estimated_duration: '',
        step_type: 'process',
        is_critical_control_point: false,
        parallel_group: null,
        next_step_condition: '',
        swim_lane: ''
      });
    } catch (error: any) {
      console.error('Adım kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleEdit = (process: Process) => {
    setFormData({
      name: process.name,
      description: process.description || '',
      department_id: process.department_id || '',
      owner_user_id: process.owner_user_id || '',
      process_category: process.process_category || '',
      kiks_standard_id: process.kiks_standard_id || '',
      is_critical: process.is_critical,
      status: process.status
    });
    setEditingId(process.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu süreci silmek istediğinizden emin misiniz? Tüm adımlar da silinecektir.')) return;

    try {
      const { error } = await supabase
        .from('ic_processes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadProcesses();
    } catch (error) {
      console.error('Süreç silinirken hata:', error);
      alert('Süreç silinemedi. Bu süreç başka kayıtlarda kullanılıyor olabilir.');
    }
  };

  const handleDeleteStep = async (id: string) => {
    if (!confirm('Bu adımı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_process_steps')
        .delete()
        .eq('id', id);

      if (error) throw error;
      if (selectedProcess) {
        loadProcessSteps(selectedProcess.id);
        loadProcesses();
      }
    } catch (error) {
      console.error('Adım silinirken hata:', error);
      alert('Adım silinemedi.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      department_id: '',
      owner_user_id: '',
      process_category: '',
      kiks_standard_id: '',
      is_critical: false,
      status: 'draft'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const assignProcessesToPlan = async () => {
    if (!selectedPlanId || unassignedProcesses.length === 0) return;

    if (!confirm(`${unassignedProcesses.length} adet plansız süreci "${selectedPlan?.name}" planına atamak istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const processIds = unassignedProcesses.map(p => p.id);

      const { error } = await supabase
        .from('ic_processes')
        .update({ ic_plan_id: selectedPlanId })
        .in('id', processIds);

      if (error) throw error;

      await supabase
        .from('ic_process_steps')
        .update({ ic_plan_id: selectedPlanId })
        .in('process_id', processIds);

      alert('Süreçler başarıyla plana atandı!');
      setShowUnassignedModal(false);
      loadData();
    } catch (error: any) {
      console.error('Süreçler plana atanırken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const resetStepForm = () => {
    setStepFormData({
      step_number: processSteps.length + 1,
      step_name: '',
      step_description: '',
      responsible_role: '',
      responsible_user_id: '',
      inputs: '',
      outputs: '',
      tools_used: '',
      estimated_duration: '',
      step_type: 'process',
      is_critical_control_point: false,
      parallel_group: null,
      next_step_condition: '',
      swim_lane: ''
    });
  };

  const toggleExpand = (processId: string) => {
    const newExpanded = new Set(expandedProcesses);
    if (newExpanded.has(processId)) {
      newExpanded.delete(processId);
    } else {
      newExpanded.add(processId);
      loadProcessSteps(processId);
    }
    setExpandedProcesses(newExpanded);
  };

  const openStepsModal = (process: Process) => {
    setSelectedProcess(process);
    loadProcessSteps(process.id);
    setStepFormData({ ...stepFormData, step_number: (process.step_count || 0) + 1 });
    setShowStepsModal(true);
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';
  const canEdit = isAdmin || profile?.department_id;

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Süreç Yönetimi</h1>
            <p className="text-sm text-gray-600">Süreç Envanteri ve İş Akış Haritaları</p>
          </div>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                Süreç Yönetimi modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>

        {unassignedProcesses.length > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-orange-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-orange-800">
                    {unassignedProcesses.length} adet plansız süreç bulundu
                  </h3>
                  <p className="text-orange-700 mt-1">
                    Bu süreçler henüz bir İç Kontrol Planına atanmamış. Bir plan seçtikten sonra bu süreçleri plana atayabilirsiniz.
                  </p>
                  <div className="mt-2">
                    <ul className="list-disc list-inside text-orange-700 text-sm">
                      {unassignedProcesses.slice(0, 5).map(p => (
                        <li key={p.id}>{p.code} - {p.name}</li>
                      ))}
                      {unassignedProcesses.length > 5 && (
                        <li>... ve {unassignedProcesses.length - 5} süreç daha</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Süreç Yönetimi</h1>
            <p className="text-sm text-gray-600">Süreç Envanteri ve İş Akış Haritaları</p>
            {selectedPlan && (
              <p className="text-xs text-gray-500">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
            )}
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Süreç
          </button>
        )}
      </div>

      {/* Plansız Süreçler Uyarısı */}
      {unassignedProcesses.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-orange-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-orange-800">
                  {unassignedProcesses.length} adet plansız süreç bulundu
                </h3>
                <p className="text-orange-700 mt-1">
                  Bu süreçler henüz bir İç Kontrol Planına atanmamış. Lütfen bu süreçleri bir plana atayın.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUnassignedModal(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 whitespace-nowrap"
            >
              Süreçleri Görüntüle
            </button>
          </div>
        </div>
      )}

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Toplam Süreç</div>
          <div className="text-2xl font-bold text-gray-900">{processes.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Aktif Süreç</div>
          <div className="text-2xl font-bold text-green-600">
            {processes.filter(p => p.status === 'active').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Kritik Süreç</div>
          <div className="text-2xl font-bold text-red-600">
            {processes.filter(p => p.is_critical).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Toplam Adım</div>
          <div className="text-2xl font-bold text-blue-600">
            {processes.reduce((sum, p) => sum + (p.step_count || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <Target className="w-4 h-4" />
            Bağlı Faaliyet
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {processes.reduce((sum, p) => sum + (p.activity_count || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Bağlı Risk
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {processes.reduce((sum, p) => sum + (p.risk_count || 0), 0)}
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Süreç Düzenle' : 'Yeni Süreç Ekle'}
                </h2>
                <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Not:</strong> Süreç kodu kayıt sırasında otomatik olarak oluşturulacaktır (Örn: SRC-2024-001)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Süreç Adı *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={formData.process_category}
                    onChange={(e) => setFormData({ ...formData, process_category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="ör: Mali, İdari"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">KİKS Standardı (İsteğe Bağlı)</label>
                  <select
                    value={formData.kiks_standard_id}
                    onChange={(e) => setFormData({ ...formData, kiks_standard_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seçiniz</option>
                    {kiksStandards.map(kiks => (
                      <option key={kiks.id} value={kiks.id}>
                        {kiks.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Bu süreç hangi KİKS standardı ile ilişkilidir?</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Müdürlük</label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Süreç Sahibi</label>
                    <select
                      value={formData.owner_user_id}
                      onChange={(e) => setFormData({ ...formData, owner_user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_critical}
                        onChange={(e) => setFormData({ ...formData, is_critical: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">Kritik Süreç</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Steps Modal */}
      {showStepsModal && selectedProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Süreç Adımları</h2>
                  <p className="text-sm text-gray-600">{selectedProcess.name}</p>
                </div>
                <button onClick={() => setShowStepsModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Yeni Adım Formu */}
              <form onSubmit={handleStepSubmit} className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">Yeni Adım Ekle</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sıra No *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={stepFormData.step_number}
                      onChange={(e) => setStepFormData({ ...stepFormData, step_number: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adım Adı *</label>
                    <input
                      type="text"
                      required
                      value={stepFormData.step_name}
                      onChange={(e) => setStepFormData({ ...stepFormData, step_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                    <textarea
                      value={stepFormData.step_description}
                      onChange={(e) => setStepFormData({ ...stepFormData, step_description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Rol</label>
                    <input
                      type="text"
                      value={stepFormData.responsible_role}
                      onChange={(e) => setStepFormData({ ...stepFormData, responsible_role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
                    <select
                      value={stepFormData.responsible_user_id}
                      onChange={(e) => setStepFormData({ ...stepFormData, responsible_user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Seçiniz</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Girdiler</label>
                    <input
                      type="text"
                      value={stepFormData.inputs}
                      onChange={(e) => setStepFormData({ ...stepFormData, inputs: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Gerekli dokümanlar, veriler"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Çıktılar</label>
                    <input
                      type="text"
                      value={stepFormData.outputs}
                      onChange={(e) => setStepFormData({ ...stepFormData, outputs: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Üretilen dokümanlar, sonuçlar"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kullanılan Araçlar</label>
                    <input
                      type="text"
                      value={stepFormData.tools_used}
                      onChange={(e) => setStepFormData({ ...stepFormData, tools_used: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Yazılım, ekipman"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adım Tipi</label>
                    <select
                      value={stepFormData.step_type}
                      onChange={(e) => setStepFormData({ ...stepFormData, step_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="process">Normal İşlem</option>
                      <option value="decision">Karar Noktası</option>
                      <option value="parallel_start">Paralel Başlangıç</option>
                      <option value="parallel_end">Paralel Bitiş</option>
                      <option value="subprocess">Alt Süreç</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Swim Lane</label>
                    <input
                      type="text"
                      value={stepFormData.swim_lane}
                      onChange={(e) => setStepFormData({ ...stepFormData, swim_lane: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Departman/Rol"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paralel Grup No</label>
                    <input
                      type="number"
                      value={stepFormData.parallel_group || ''}
                      onChange={(e) => setStepFormData({ ...stepFormData, parallel_group: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Paralel işlemler için"
                    />
                  </div>

                  {stepFormData.step_type === 'decision' && (
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Karar Koşulu</label>
                      <input
                        type="text"
                        value={stepFormData.next_step_condition}
                        onChange={(e) => setStepFormData({ ...stepFormData, next_step_condition: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Örn: Onaylandıysa adım 5'e, reddedildiyse adım 3'e"
                      />
                    </div>
                  )}

                  <div className="col-span-3 flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Süre</label>
                      <input
                        type="text"
                        value={stepFormData.estimated_duration}
                        onChange={(e) => setStepFormData({ ...stepFormData, estimated_duration: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Örn: 2 saat, 1 gün"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="is_critical_control_point"
                        checked={stepFormData.is_critical_control_point}
                        onChange={(e) => setStepFormData({ ...stepFormData, is_critical_control_point: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="is_critical_control_point" className="text-sm font-medium text-red-700">
                        Kritik Kontrol Noktası (KKN)
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                </div>
              </form>

              {/* Adımlar Listesi */}
              <div className="space-y-2">
                {processSteps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Henüz adım eklenmemiş
                  </div>
                ) : (
                  processSteps.map((step) => (
                    <div key={step.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                            {step.step_number}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                {step.step_name}
                                {step.is_critical_control_point && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    KKN
                                  </span>
                                )}
                              </h4>
                              {step.step_description && (
                                <p className="text-sm text-gray-600 mt-1">{step.step_description}</p>
                              )}
                              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                {step.responsible_role && (
                                  <span>Rol: {step.responsible_role}</span>
                                )}
                                {step.responsible_user_name && (
                                  <span>Sorumlu: {step.responsible_user_name}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteStep(step.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Süreçler Listesi */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      ) : processes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Henüz süreç eklenmemiş.</p>
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              İlk Süreci Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {processes.map((process) => (
            <div key={process.id} className="bg-white rounded-lg shadow">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleExpand(process.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedProcesses.has(process.id) ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{process.code}</span>
                        <span className="text-gray-600">-</span>
                        <span className="text-gray-900">{process.name}</span>
                        {process.is_critical && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">Kritik</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[process.status]}`}>
                          {STATUS_LABELS[process.status]}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        {process.department_name && <span>Müdürlük: {process.department_name}</span>}
                        {process.owner_name && <span>Sahip: {process.owner_name}</span>}
                        {process.kiks_standard_title && (
                          <span className="text-blue-600">KİKS: {process.kiks_standard_title}</span>
                        )}
                        <span>{process.step_count || 0} Adım</span>
                        {(process.activity_count || 0) > 0 && (
                          <span className="text-purple-600 flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {process.activity_count} Faaliyet
                          </span>
                        )}
                        {(process.risk_count || 0) > 0 && (
                          <span className="text-orange-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {process.risk_count} Risk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openStepsModal(process)}
                      className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-600 rounded"
                    >
                      Adımları Yönet
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProcess(process);
                        loadProcessSteps(process.id);
                        setShowFlowDiagram(true);
                      }}
                      className="text-green-600 hover:text-green-800 text-sm px-3 py-1 border border-green-600 rounded flex items-center gap-1"
                    >
                      <Network className="w-4 h-4" />
                      Akış Diyagramı
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => handleEdit(process)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(process.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {process.description && (
                  <p className="text-sm text-gray-600 mt-2 ml-8">{process.description}</p>
                )}
              </div>

              {/* Genişletilmiş Adımlar */}
              {expandedProcesses.has(process.id) && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {processSteps.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">Adım yükleniyor...</div>
                  ) : (
                    <div className="space-y-2">
                      {processSteps.map((step) => (
                        <div key={step.id} className="flex items-start gap-3 bg-white p-3 rounded">
                          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {step.step_number}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              {step.step_name}
                              {step.is_critical_control_point && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  KKN
                                </span>
                              )}
                            </div>
                            {step.description && (
                              <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plansız Süreçler Modal */}
      {showUnassignedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Plansız Süreçler</h2>
                  <p className="text-sm text-gray-600">Bu süreçler henüz bir İç Kontrol Planına atanmamış</p>
                </div>
                <button
                  onClick={() => setShowUnassignedModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {unassignedProcesses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Plansız süreç bulunamadı
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Not:</strong> Aşağıdaki {unassignedProcesses.length} süreç "{selectedPlan?.name}" planına atanacaktır.
                    </p>
                  </div>

                  <div className="space-y-2 mb-6">
                    {unassignedProcesses.map((process) => (
                      <div
                        key={process.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{process.code}</span>
                              <span className="text-gray-600">-</span>
                              <span className="text-gray-900">{process.name}</span>
                              {process.is_critical && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                  Kritik
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[process.status]}`}>
                                {STATUS_LABELS[process.status]}
                              </span>
                            </div>
                            <div className="flex gap-4 text-sm text-gray-600">
                              {process.department_name && (
                                <span>Müdürlük: {process.department_name}</span>
                              )}
                              {process.owner_name && <span>Sahip: {process.owner_name}</span>}
                              {process.process_category && (
                                <span>Kategori: {process.process_category}</span>
                              )}
                            </div>
                            {process.description && (
                              <p className="text-sm text-gray-600 mt-2">{process.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      onClick={() => setShowUnassignedModal(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      onClick={assignProcessesToPlan}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                      <LinkIcon className="w-5 h-5" />
                      Plana Ata
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flow Diagram Modal */}
      {showFlowDiagram && selectedProcess && (
        <ProcessFlowDiagram
          process={selectedProcess}
          steps={processSteps}
          onClose={() => setShowFlowDiagram(false)}
          onStepsUpdate={() => loadProcessSteps(selectedProcess.id)}
        />
      )}
    </div>
  );
}
