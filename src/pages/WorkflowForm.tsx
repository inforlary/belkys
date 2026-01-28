import { useState, useEffect } from 'react';
import { ArrowLeft, Save, X, Plus, Trash2, AlertCircle, AlertTriangle, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { WorkflowFormData, STEP_TYPE_CONFIG, ACTOR_TITLES, ACTOR_ROLES, DEPARTMENTS } from '../types/workflow';
import WorkflowPreview from '../components/WorkflowPreview';

type TabType = 'basic' | 'actors' | 'steps';

export default function WorkflowForm() {
  const { navigate, currentPath } = useLocation();
  const pathParts = currentPath.split('/');
  const isEditMode = pathParts.includes('edit');
  const workflowId = isEditMode ? pathParts[pathParts.length - 1] : null;
  const templateId = !isEditMode ? pathParts[pathParts.length - 1] : null;
  const qmProcessId = new URLSearchParams(window.location.search).get('qm_process_id');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [qmProcesses, setQmProcesses] = useState<any[]>([]);

  const [formData, setFormData] = useState<WorkflowFormData>({
    code: '',
    name: '',
    description: '',
    qm_process_id: '',
    trigger_event: '',
    outputs: '',
    software_used: '',
    legal_basis: '',
    actors: [],
    steps: []
  });

  useEffect(() => {
    fetchDepartments();
    fetchQmProcesses();
    if (isEditMode && workflowId) {
      loadWorkflow();
    } else if (qmProcessId) {
      loadFromQMProcess();
    } else if (templateId && templateId !== 'blank') {
      loadTemplate();
    }
  }, [templateId, workflowId, isEditMode, qmProcessId]);

  async function fetchDepartments() {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  }

  async function fetchQmProcesses() {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('qm_processes')
        .select('id, code, name, description, status, owner_department:departments(name)')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'APPROVED')
        .order('code');

      if (error) {
        console.error('Error fetching QM processes:', error);
      } else {
        console.log('QM Processes loaded:', data?.length, 'processes');
      }

      setQmProcesses(data || []);
    } catch (error) {
      console.error('Error fetching QM processes:', error);
    }
  }

  async function loadWorkflow() {
    try {
      const { data: workflow, error: workflowError } = await supabase
        .from('workflow_processes')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (workflowError) throw workflowError;

      const { data: actors, error: actorsError } = await supabase
        .from('workflow_actors')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('order_index');

      if (actorsError) throw actorsError;

      const { data: steps, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('order_index');

      if (stepsError) throw stepsError;

      setFormData({
        code: workflow.code,
        name: workflow.name,
        description: workflow.description || '',
        qm_process_id: workflow.qm_process_id || '',
        trigger_event: workflow.trigger_event || '',
        outputs: workflow.outputs || '',
        software_used: workflow.software_used || '',
        legal_basis: workflow.legal_basis || '',
        actors: actors || [],
        steps: steps || []
      });
    } catch (error) {
      console.error('Error loading workflow:', error);
      alert('İş akışı yüklenirken hata oluştu');
    }
  }

  async function loadFromQMProcess() {
    try {
      const { data: qmProcess, error } = await supabase
        .from('qm_processes')
        .select('*, owner_department:departments(id, name)')
        .eq('id', qmProcessId)
        .single();

      if (error) throw error;

      if (qmProcess) {
        setFormData(prev => ({
          ...prev,
          code: 'Otomatik üretilecek',
          name: qmProcess.name,
          description: qmProcess.purpose || '',
          qm_process_id: qmProcess.id,
          trigger_event: qmProcess.inputs || '',
          outputs: qmProcess.outputs || ''
        }));
      }
    } catch (error) {
      console.error('Error loading QM process:', error);
      alert('Süreç bilgileri yüklenirken hata oluştu');
    }
  }

  async function loadTemplate() {
    try {
      const { data, error } = await supabase
        .from('workflow_process_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      if (data?.template_data) {
        setFormData(prev => ({
          ...prev,
          name: data.name,
          actors: data.template_data.actors.map((a: any, idx: number) => ({
            order_index: idx,
            title: a.title,
            department: a.department,
            role: a.role
          })),
          steps: data.template_data.steps.map((s: any, idx: number) => ({
            order_index: idx,
            step_type: s.type,
            description: s.description,
            actor_id: `temp-${s.actorIndex}`,
            is_sensitive: s.sensitive,
            yes_target_step: s.yesTarget !== undefined ? `temp-${s.yesTarget}` : undefined,
            no_target_step: s.noTarget !== undefined ? `temp-${s.noTarget}` : undefined
          }))
        }));
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  }

  async function generateWorkflowCode() {
    if (!user) return 'WF-001';

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) return 'WF-001';

      const { count } = await supabase
        .from('workflow_processes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id);

      const nextNumber = (count || 0) + 1;
      return `WF-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating workflow code:', error);
      return 'WF-001';
    }
  }

  const addActor = () => {
    setFormData(prev => ({
      ...prev,
      actors: [...prev.actors, {
        order_index: prev.actors.length,
        title: '',
        department: '',
        role: ''
      }]
    }));
  };

  const removeActor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actors: prev.actors.filter((_, i) => i !== index).map((a, i) => ({ ...a, order_index: i }))
    }));
  };

  const updateActor = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      actors: prev.actors.map((a, i) => i === index ? { ...a, [field]: value } : a)
    }));
  };

  const addStep = (type: string) => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, {
        order_index: prev.steps.length,
        step_type: type as any,
        description: '',
        actor_id: prev.actors.length > 0 ? `temp-0` : undefined,
        is_sensitive: false
      }]
    }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order_index: i }))
    }));
  };

  const updateStep = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.name || formData.actors.length === 0 || formData.steps.length === 0) {
      alert('Lütfen tüm zorunlu alanları doldurun (Süreç Adı, Görevliler ve Adımlar)');
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      let workflowCode = formData.code;
      if (!workflowCode || workflowCode === 'Otomatik üretilecek') {
        workflowCode = await generateWorkflowCode();
      }

      let workflow: any;

      if (isEditMode && workflowId) {
        const { data, error: workflowError } = await supabase
          .from('workflow_processes')
          .update({
            code: workflowCode,
            name: formData.name,
            description: formData.description,
            qm_process_id: formData.qm_process_id,
            trigger_event: formData.trigger_event,
            outputs: formData.outputs,
            software_used: formData.software_used,
            legal_basis: formData.legal_basis
          })
          .eq('id', workflowId)
          .select()
          .single();

        if (workflowError) throw workflowError;
        workflow = data;

        await supabase.from('workflow_actors').delete().eq('workflow_id', workflowId);
        await supabase.from('workflow_steps').delete().eq('workflow_id', workflowId);
      } else {
        const { data, error: workflowError } = await supabase
          .from('workflow_processes')
          .insert({
            organization_id: profile.organization_id,
            code: workflowCode,
            name: formData.name,
            description: formData.description,
            qm_process_id: formData.qm_process_id,
            trigger_event: formData.trigger_event,
            outputs: formData.outputs,
            software_used: formData.software_used,
            legal_basis: formData.legal_basis,
            created_by: user.id,
            status: 'draft'
          })
          .select()
          .single();

        if (workflowError) throw workflowError;
        workflow = data;
      }

      const actorsData = formData.actors.map(a => ({
        workflow_id: workflow.id,
        order_index: a.order_index,
        title: a.title,
        department: a.department,
        role: a.role
      }));

      const { data: insertedActors, error: actorsError } = await supabase
        .from('workflow_actors')
        .insert(actorsData)
        .select();

      if (actorsError) throw actorsError;

      const actorIdMap = new Map();
      insertedActors.forEach((actor, i) => {
        actorIdMap.set(`temp-${i}`, actor.id);
        if (formData.actors[i].id) {
          actorIdMap.set(formData.actors[i].id, actor.id);
        }
      });

      const stepsData = formData.steps.map(s => ({
        workflow_id: workflow.id,
        order_index: s.order_index,
        step_type: s.step_type,
        description: s.description,
        actor_id: s.actor_id ? (actorIdMap.get(s.actor_id) || actorIdMap.get(`temp-${formData.actors.findIndex(a => a.id === s.actor_id)}`)) : null,
        is_sensitive: s.is_sensitive,
        yes_target_step: s.yes_target_step,
        no_target_step: s.no_target_step
      }));

      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .insert(stepsData);

      if (stepsError) throw stepsError;

      alert(isEditMode ? 'İş akışı güncellendi' : 'İş akışı oluşturuldu');
      navigate(`/workflows/${workflow.id}`);
    } catch (error: any) {
      console.error('Error saving workflow:', error);
      alert(error.message || 'Kaydederken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workflows')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'İş Akış Şeması Düzenle' : 'Yeni İş Akış Şeması'}
            </h1>
            <p className="text-gray-600 mt-1">İş sürecinizi tanımlayın ve görselleştirin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/workflows')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <X className="w-5 h-5" />
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('basic')}
                className={`flex-1 px-6 py-3 text-sm font-medium ${
                  activeTab === 'basic'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Temel Bilgiler
              </button>
              <button
                onClick={() => setActiveTab('actors')}
                className={`flex-1 px-6 py-3 text-sm font-medium ${
                  activeTab === 'actors'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Görevliler ({formData.actors.length})
              </button>
              <button
                onClick={() => setActiveTab('steps')}
                className={`flex-1 px-6 py-3 text-sm font-medium ${
                  activeTab === 'steps'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                İş Adımları ({formData.steps.length})
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Süreç Kodu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      placeholder="Otomatik üretilecek (WF-001)"
                    />
                    <p className="text-xs text-gray-500 mt-1">Kayıt sırasında otomatik oluşturulacaktır</p>
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
                      placeholder="Süreç adını girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      QM Süreci <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.qm_process_id}
                      onChange={(e) => setFormData({ ...formData, qm_process_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">QM Süreci Seçiniz...</option>
                      {qmProcesses.length === 0 ? (
                        <option disabled>Henüz onaylanmış QM süreci yok</option>
                      ) : (
                        qmProcesses.map(process => (
                          <option key={process.id} value={process.id}>
                            {process.code} - {process.name}
                            {process.status && process.status !== 'ACTIVE' && ` (${process.status})`}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Sadece onaylanmış QM süreçleri gösterilmektedir
                      {qmProcesses.length > 0 && ` (${qmProcesses.length} onaylı süreç)`}
                    </p>
                  </div>

                  {formData.qm_process_id && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium mb-1">
                        Seçili QM Süreci
                      </p>
                      <p className="text-sm text-blue-700">
                        {(() => {
                          const selectedProcess = qmProcesses.find(p => p.id === formData.qm_process_id);
                          return selectedProcess ? (
                            <>
                              <strong>{selectedProcess.code}</strong> - {selectedProcess.name}
                              {selectedProcess.owner_department && (
                                <span className="block mt-1 text-xs">
                                  Sorumlu Birim: <strong>{selectedProcess.owner_department.name}</strong>
                                </span>
                              )}
                            </>
                          ) : 'Yükleniyor...';
                        })()}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Süreç Açıklaması</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Sürecin kısa açıklaması"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Süreci Başlatan Olay</label>
                    <textarea
                      value={formData.trigger_event}
                      onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Süreç Çıktıları</label>
                    <textarea
                      value={formData.outputs}
                      onChange={(e) => setFormData({ ...formData, outputs: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kullanılan Yazılımlar</label>
                    <input
                      type="text"
                      value={formData.software_used}
                      onChange={(e) => setFormData({ ...formData, software_used: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dayanak Mevzuat</label>
                    <textarea
                      value={formData.legal_basis}
                      onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'actors' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900">
                        İş akışında yer alacak görevlileri tanımlayın. Her görevli için ünvan, birim ve rol bilgilerini girin.
                        Görevlilerin sırası swimlane diyagramında kullanılacaktır.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={addActor}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="w-5 h-5" />
                    Görevli Ekle
                  </button>

                  <div className="space-y-3">
                    {formData.actors.map((actor, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 text-gray-400 mt-2">
                            <GripVertical className="w-5 h-5" />
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Görev Ünvanı</label>
                              <select
                                value={actor.title}
                                onChange={(e) => updateActor(index, 'title', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">Seçiniz</option>
                                {ACTOR_TITLES.map(title => (
                                  <option key={title} value={title}>{title}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Birim</label>
                              <select
                                value={actor.department}
                                onChange={(e) => updateActor(index, 'department', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">Seçiniz</option>
                                {DEPARTMENTS.map(dept => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Roldeki Görevi</label>
                              <select
                                value={actor.role}
                                onChange={(e) => updateActor(index, 'role', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">Seçiniz</option>
                                {ACTOR_ROLES.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={() => removeActor(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg mt-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'steps' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900">
                        İş akışının adımlarını sırayla ekleyin. Her adım için türünü seçin ve sorumlu görevliyi atayın.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(STEP_TYPE_CONFIG).map(([type, config]) => (
                      <button
                        key={type}
                        onClick={() => addStep(type)}
                        className="flex flex-col items-start p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                        style={{ borderLeftColor: config.color, borderLeftWidth: '4px' }}
                      >
                        <div className="font-semibold text-gray-900 mb-1">{config.label}</div>
                        <div className="text-xs text-gray-600 mb-2">{config.description}</div>
                        <div className="text-xs text-gray-500 italic">{config.example}</div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 mt-6">
                    {formData.steps.map((step, index) => {
                      const config = STEP_TYPE_CONFIG[step.step_type];
                      return (
                        <div
                          key={index}
                          className="border-l-4 border-gray-200 rounded-lg p-4 bg-gray-50"
                          style={{ borderLeftColor: config.color }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center gap-2 mt-2">
                              <GripVertical className="w-5 h-5 text-gray-400" />
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                style={{ backgroundColor: config.color }}
                              >
                                {index + 1}
                              </div>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  {step.step_type === 'decision' ? 'Karar Sorusu' : 'Adım Açıklaması'}
                                </label>
                                <input
                                  type="text"
                                  value={step.description}
                                  onChange={(e) => updateStep(index, 'description', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder={step.step_type === 'decision' ? 'Örn: Onaylandı mı?' : 'Adımın açıklaması'}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Sorumlu Görevli</label>
                                  <select
                                    value={step.actor_id}
                                    onChange={(e) => updateStep(index, 'actor_id', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value="">Seçiniz</option>
                                    {formData.actors.map((actor, i) => (
                                      <option key={i} value={`temp-${i}`}>
                                        {actor.title || `Görevli ${i + 1}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className={`p-3 rounded-lg border-2 ${step.is_sensitive ? 'bg-orange-50 border-orange-300' : 'border-gray-200'}`}>
                                  <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={step.is_sensitive}
                                      onChange={(e) => updateStep(index, 'is_sensitive', e.target.checked)}
                                      className="mt-0.5 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                    />
                                    <div className="flex-1">
                                      <span className="text-sm font-medium text-gray-900">Hassas Görev</span>
                                      <p className="text-xs text-gray-600 mt-0.5">
                                        Yolsuzluk riski taşıyan görevler için işaretleyin
                                      </p>
                                      {step.is_sensitive && (
                                        <div className="flex items-center gap-1 mt-2 text-xs font-medium text-orange-700">
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          <span>Onaylandıktan sonra Hassas Görevler modülüne aktarılacaktır</span>
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeStep(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg mt-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Canlı Önizleme</h3>
          <WorkflowPreview actors={formData.actors} steps={formData.steps} />
        </div>
      </div>
    </div>
  );
}
