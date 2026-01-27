import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  ChevronDown, ChevronUp, Save, X, Plus, Trash2, Send, GripVertical
} from 'lucide-react';
import Button from '../components/ui/Button';

interface Category {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
  department_id: string;
}

interface Goal {
  id: string;
  code: string;
  name: string;
}

interface Risk {
  id: string;
  code: string;
  name: string;
  current_level: string;
}

export default function BPMProcessForm() {
  const { currentPath, navigate } = useLocation();
  const id = currentPath.match(/process-management\/([^/]+)\/edit$/)?.[1];
  const { user, profile } = useAuth();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [parentProcesses, setParentProcesses] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([1]));

  const [formData, setFormData] = useState({
    category_id: '',
    parent_id: '',
    code: '',
    name: '',
    description: '',
    owner_department_id: '',
    responsible_person_id: '',
    purpose: '',
    scope: '',
    start_event: '',
    end_event: '',
    inputs: [''],
    outputs: [''],
    regulations: [{ type: 'Kanun', name: '', articles: '' }],
    human_resource: '',
    technological_resource: '',
    financial_resource: '',
    risk_ids: [] as string[],
    strategic_goal_id: '',
    workflow_process_id: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      fetchOptions();
      if (isEdit) {
        fetchProcess();
      }
    }
  }, [profile, id]);

  useEffect(() => {
    if (formData.owner_department_id) {
      fetchDepartmentUsers(formData.owner_department_id);
    }
  }, [formData.owner_department_id]);

  useEffect(() => {
    if (formData.category_id && !isEdit) {
      generateCode();
    }
  }, [formData.category_id, formData.parent_id]);

  const fetchOptions = async () => {
    const [cats, depts, goalsData, risksData, workflowsData] = await Promise.all([
      supabase.from('bpm_categories').select('*').eq('organization_id', profile?.organization_id).order('sort_order'),
      supabase.from('departments').select('id, name').eq('organization_id', profile?.organization_id).order('name'),
      supabase.from('goals').select('id, code, name').eq('organization_id', profile?.organization_id).order('code'),
      supabase.from('risks').select('id, code, name, current_level').eq('organization_id', profile?.organization_id).order('code'),
      supabase.from('workflow_processes').select('id, code, name').eq('organization_id', profile?.organization_id).order('code')
    ]);

    if (cats.data) setCategories(cats.data);
    if (depts.data) setDepartments(depts.data);
    if (goalsData.data) setGoals(goalsData.data);
    if (risksData.data) setRisks(risksData.data);
    if (workflowsData.data) setWorkflows(workflowsData.data);
  };

  const fetchDepartmentUsers = async (deptId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, department_id')
      .eq('organization_id', profile?.organization_id)
      .eq('department_id', deptId)
      .order('full_name');

    if (data) setUsers(data);
  };

  const fetchProcess = async () => {
    try {
      const { data, error } = await supabase
        .from('bpm_processes')
        .select(`
          *,
          regulations:bpm_process_regulations(*),
          process_risks:bpm_process_risks(risk_id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          category_id: data.category_id,
          parent_id: data.parent_id || '',
          code: data.code,
          name: data.name,
          description: data.description || '',
          owner_department_id: data.owner_department_id || '',
          responsible_person_id: data.responsible_person_id || '',
          purpose: data.purpose || '',
          scope: data.scope || '',
          start_event: data.start_event || '',
          end_event: data.end_event || '',
          inputs: data.inputs || [''],
          outputs: data.outputs || [''],
          regulations: data.regulations?.length > 0 ? data.regulations.map((r: any) => ({
            type: r.regulation_type,
            name: r.name,
            articles: r.related_articles || ''
          })) : [{ type: 'Kanun', name: '', articles: '' }],
          human_resource: data.human_resource || '',
          technological_resource: data.technological_resource || '',
          financial_resource: data.financial_resource || '',
          risk_ids: data.process_risks?.map((pr: any) => pr.risk_id) || [],
          strategic_goal_id: data.strategic_goal_id || '',
          workflow_process_id: data.workflow_process_id || ''
        });
      }
    } catch (error) {
      console.error('Error fetching process:', error);
    }
  };

  const generateCode = async () => {
    if (!formData.category_id) return;

    try {
      const category = categories.find(c => c.id === formData.category_id);
      if (!category) return;

      const { data, error } = await supabase.rpc('generate_bpm_process_code', {
        p_organization_id: profile?.organization_id,
        p_category_code: category.code,
        p_parent_id: formData.parent_id || null
      });

      if (error) throw error;
      if (data) {
        setFormData(prev => ({ ...prev, code: data }));
      }
    } catch (error) {
      console.error('Error generating code:', error);
    }
  };

  const handleSubmit = async (submitForApproval: boolean = false) => {
    setLoading(true);
    try {
      const processData = {
        organization_id: profile?.organization_id,
        category_id: formData.category_id,
        parent_id: formData.parent_id || null,
        code: formData.code,
        name: formData.name,
        description: formData.description,
        owner_department_id: formData.owner_department_id || null,
        responsible_person_id: formData.responsible_person_id || null,
        purpose: formData.purpose,
        scope: formData.scope,
        start_event: formData.start_event,
        end_event: formData.end_event,
        inputs: formData.inputs.filter(i => i.trim()),
        outputs: formData.outputs.filter(o => o.trim()),
        human_resource: formData.human_resource,
        technological_resource: formData.technological_resource,
        financial_resource: formData.financial_resource,
        strategic_goal_id: formData.strategic_goal_id || null,
        workflow_process_id: formData.workflow_process_id || null,
        status: submitForApproval ? 'pending_approval' : 'draft',
        submitted_by: submitForApproval ? user?.id : null,
        submitted_at: submitForApproval ? new Date().toISOString() : null,
        created_by: isEdit ? undefined : user?.id
      };

      let processId = id;

      if (isEdit) {
        const { error } = await supabase
          .from('bpm_processes')
          .update(processData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { data: newProcess, error } = await supabase
          .from('bpm_processes')
          .insert(processData)
          .select()
          .single();

        if (error) throw error;
        processId = newProcess.id;
      }

      if (isEdit) {
        await supabase.from('bpm_process_regulations').delete().eq('process_id', id);
        await supabase.from('bpm_process_risks').delete().eq('process_id', id);
      }

      if (formData.regulations.some(r => r.name.trim())) {
        const regulationsData = formData.regulations
          .filter(r => r.name.trim())
          .map(r => ({
            process_id: processId,
            regulation_type: r.type,
            name: r.name,
            related_articles: r.articles,
            created_by: user?.id
          }));

        await supabase.from('bpm_process_regulations').insert(regulationsData);
      }

      if (formData.risk_ids.length > 0) {
        const risksData = formData.risk_ids.map(riskId => ({
          process_id: processId,
          risk_id: riskId,
          created_by: user?.id
        }));

        await supabase.from('bpm_process_risks').insert(risksData);
      }

      navigate('/process-management/list');
    } catch (error: any) {
      console.error('Error saving process:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const addItem = (field: 'inputs' | 'outputs') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeItem = (field: 'inputs' | 'outputs', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const updateItem = (field: 'inputs' | 'outputs', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addRegulation = () => {
    setFormData(prev => ({
      ...prev,
      regulations: [...prev.regulations, { type: 'Kanun', name: '', articles: '' }]
    }));
  };

  const removeRegulation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      regulations: prev.regulations.filter((_, i) => i !== index)
    }));
  };

  const updateRegulation = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      regulations: prev.regulations.map((reg, i) =>
        i === index ? { ...reg, [field]: value } : reg
      )
    }));
  };

  const renderSection = (
    section: number,
    title: string,
    content: React.ReactNode
  ) => {
    const isExpanded = expandedSections.has(section);

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <button
          type="button"
          onClick={() => toggleSection(section)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
        >
          <span className="font-semibold text-gray-900">{section}. {title}</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {isExpanded && (
          <div className="p-4 border-t border-gray-200">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Süreç Düzenle' : 'Yeni Süreç'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Süreç bilgilerini girin
          </p>
        </div>
      </div>

      <form className="space-y-4">
        {renderSection(1, 'Temel Bilgiler', (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori *
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value, parent_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seçiniz</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Üst Süreç
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!formData.category_id}
                >
                  <option value="">Yok (Ana Seviye)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Süreç Kodu
                </label>
                <input
                  type="text"
                  value={formData.code}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Süreç Adı *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sorumlu Birim
                </label>
                <select
                  value={formData.owner_department_id}
                  onChange={(e) => setFormData({ ...formData, owner_department_id: e.target.value, responsible_person_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Seçiniz</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sorumlu Kişi
                </label>
                <select
                  value={formData.responsible_person_id}
                  onChange={(e) => setFormData({ ...formData, responsible_person_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!formData.owner_department_id}
                >
                  <option value="">Seçiniz</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        {renderSection(2, 'Tanım ve Kapsam', (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amaç
              </label>
              <textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kapsam
              </label>
              <textarea
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Başlangıç Olayı
                </label>
                <input
                  type="text"
                  value={formData.start_event}
                  onChange={(e) => setFormData({ ...formData, start_event: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bitiş Olayı
                </label>
                <input
                  type="text"
                  value={formData.end_event}
                  onChange={(e) => setFormData({ ...formData, end_event: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        ))}

        {renderSection(3, 'Girdi ve Çıktılar', (
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Girdiler</label>
                <Button type="button" size="sm" variant="outline" onClick={() => addItem('inputs')}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ekle
                </Button>
              </div>
              <div className="space-y-2">
                {formData.inputs.map((input, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => updateItem('inputs', index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Girdi açıklaması"
                    />
                    {formData.inputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem('inputs', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Çıktılar</label>
                <Button type="button" size="sm" variant="outline" onClick={() => addItem('outputs')}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ekle
                </Button>
              </div>
              <div className="space-y-2">
                {formData.outputs.map((output, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={output}
                      onChange={(e) => updateItem('outputs', index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Çıktı açıklaması"
                    />
                    {formData.outputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem('outputs', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {renderSection(4, 'Yasal Dayanak', (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Mevzuat Bilgileri</label>
              <Button type="button" size="sm" variant="outline" onClick={addRegulation}>
                <Plus className="w-4 h-4 mr-1" />
                Ekle
              </Button>
            </div>
            <div className="space-y-3">
              {formData.regulations.map((reg, index) => (
                <div key={index} className="flex gap-2 items-start p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <select
                      value={reg.type}
                      onChange={(e) => updateRegulation(index, 'type', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="Kanun">Kanun</option>
                      <option value="Yönetmelik">Yönetmelik</option>
                      <option value="Tüzük">Tüzük</option>
                      <option value="Genelge">Genelge</option>
                      <option value="Tebliğ">Tebliğ</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                    <input
                      type="text"
                      value={reg.name}
                      onChange={(e) => updateRegulation(index, 'name', e.target.value)}
                      placeholder="Mevzuat adı"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={reg.articles}
                      onChange={(e) => updateRegulation(index, 'articles', e.target.value)}
                      placeholder="İlgili maddeler"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  {formData.regulations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRegulation(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {renderSection(5, 'Kaynaklar', (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İnsan Kaynağı
              </label>
              <textarea
                value={formData.human_resource}
                onChange={(e) => setFormData({ ...formData, human_resource: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Süreç için gerekli insan kaynağı"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teknolojik Kaynak
              </label>
              <textarea
                value={formData.technological_resource}
                onChange={(e) => setFormData({ ...formData, technological_resource: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Süreç için gerekli teknolojik kaynak"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mali Kaynak
              </label>
              <textarea
                value={formData.financial_resource}
                onChange={(e) => setFormData({ ...formData, financial_resource: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Süreç için gerekli mali kaynak"
              />
            </div>
          </div>
        ))}

        {renderSection(6, 'Risk İlişkilendirme', (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              İlişkili Riskler
            </label>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
              {risks.map(risk => (
                <label key={risk.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={formData.risk_ids.includes(risk.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, risk_ids: [...prev.risk_ids, risk.id] }));
                      } else {
                        setFormData(prev => ({ ...prev, risk_ids: prev.risk_ids.filter(id => id !== risk.id) }));
                      }
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-mono text-gray-600">{risk.code}</span>
                  <span className="text-sm flex-1">{risk.name}</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">{risk.current_level}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {renderSection(7, 'Stratejik Hedef Bağlantısı', (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stratejik Hedef
            </label>
            <select
              value={formData.strategic_goal_id}
              onChange={(e) => setFormData({ ...formData, strategic_goal_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Seçiniz</option>
              {goals.map(goal => (
                <option key={goal.id} value={goal.id}>{goal.code} - {goal.name}</option>
              ))}
            </select>
          </div>
        ))}

        {renderSection(8, 'İş Akışı Bağlantısı', (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İş Akışı Şeması
            </label>
            <select
              value={formData.workflow_process_id}
              onChange={(e) => setFormData({ ...formData, workflow_process_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Seçiniz</option>
              {workflows.map(wf => (
                <option key={wf.id} value={wf.id}>{wf.code} - {wf.name}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              Henüz iş akışı oluşturmadıysanız, önce İş Akışı Yönetimi modülünden oluşturabilirsiniz.
            </p>
          </div>
        ))}

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/process-management/list')}
          >
            <X className="w-4 h-4 mr-2" />
            İptal
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading}
          >
            <Save className="w-4 h-4 mr-2" />
            Taslak Kaydet
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
          >
            <Send className="w-4 h-4 mr-2" />
            Onaya Gönder
          </Button>
        </div>
      </form>
    </div>
  );
}