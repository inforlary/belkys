import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, Shield, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface Component {
  id: string;
  code: string;
  name: string;
  order_index: number;
}

interface Standard {
  id: string;
  component_id: string;
  code: string;
  name: string;
  description: string;
  order_index: number;
}

interface GeneralCondition {
  id: string;
  standard_id: string;
  code: string;
  description: string;
  order_index: number;
}

export default function ICStandardsManager() {
  const [components, setComponents] = useState<Component[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [conditions, setConditions] = useState<GeneralCondition[]>([]);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [showStandardModal, setShowStandardModal] = useState(false);
  const [editingStandard, setEditingStandard] = useState<Standard | null>(null);
  const [standardComponentId, setStandardComponentId] = useState('');
  const [standardForm, setStandardForm] = useState({
    code: '',
    name: '',
    description: '',
    order_index: 0
  });

  const [showConditionModal, setShowConditionModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState<GeneralCondition | null>(null);
  const [conditionStandardId, setConditionStandardId] = useState('');
  const [conditionForm, setConditionForm] = useState({
    code: '',
    description: '',
    order_index: 0
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [componentsRes, standardsRes, conditionsRes] = await Promise.all([
        supabase.from('ic_components').select('*').is('organization_id', null).order('order_index'),
        supabase.from('ic_standards').select('*').order('component_id, order_index'),
        supabase.from('ic_general_conditions').select('*').order('standard_id, order_index')
      ]);

      if (componentsRes.error) throw componentsRes.error;
      if (standardsRes.error) throw standardsRes.error;
      if (conditionsRes.error) throw conditionsRes.error;

      setComponents(componentsRes.data || []);
      setStandards(standardsRes.data || []);
      setConditions(conditionsRes.data || []);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
      alert('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStandard = (componentId: string) => {
    const componentStandards = standards.filter(s => s.component_id === componentId);
    setEditingStandard(null);
    setStandardComponentId(componentId);
    setStandardForm({
      code: '',
      name: '',
      description: '',
      order_index: componentStandards.length > 0 ? Math.max(...componentStandards.map(s => s.order_index)) + 1 : 1
    });
    setShowStandardModal(true);
  };

  const handleEditStandard = (standard: Standard) => {
    setEditingStandard(standard);
    setStandardComponentId(standard.component_id);
    setStandardForm({
      code: standard.code,
      name: standard.name,
      description: standard.description,
      order_index: standard.order_index
    });
    setShowStandardModal(true);
  };

  const saveStandard = async () => {
    if (!standardForm.code || !standardForm.name) {
      alert('Kod ve isim zorunludur');
      return;
    }

    setSaving(true);
    try {
      const data = {
        component_id: standardComponentId,
        code: standardForm.code,
        name: standardForm.name,
        description: standardForm.description,
        order_index: standardForm.order_index
      };

      if (editingStandard) {
        const { error } = await supabase.from('ic_standards').update(data).eq('id', editingStandard.id);
        if (error) throw error;
        alert('Standart güncellendi');
      } else {
        const { error } = await supabase.from('ic_standards').insert(data);
        if (error) throw error;
        alert('Standart eklendi');
      }

      setShowStandardModal(false);
      setEditingStandard(null);
      setStandardForm({ code: '', name: '', description: '', order_index: 0 });
      await loadData();
    } catch (error: any) {
      alert(`Hata: ${error?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteStandard = async (id: string) => {
    if (!confirm('Standart ve tüm genel şartları silinecek. Emin misiniz?')) return;

    try {
      const { error } = await supabase.from('ic_standards').delete().eq('id', id);
      if (error) throw error;
      alert('Standart silindi');
      await loadData();
    } catch (error: any) {
      alert(`Hata: ${error?.message}`);
    }
  };

  const handleAddCondition = (standardId: string) => {
    const standardConditions = conditions.filter(c => c.standard_id === standardId);
    setEditingCondition(null);
    setConditionStandardId(standardId);
    setConditionForm({
      code: '',
      description: '',
      order_index: standardConditions.length > 0 ? Math.max(...standardConditions.map(c => c.order_index)) + 1 : 1
    });
    setShowConditionModal(true);
  };

  const handleEditCondition = (condition: GeneralCondition) => {
    setEditingCondition(condition);
    setConditionStandardId(condition.standard_id);
    setConditionForm({
      code: condition.code,
      description: condition.description,
      order_index: condition.order_index
    });
    setShowConditionModal(true);
  };

  const saveCondition = async () => {
    if (!conditionForm.code || !conditionForm.description) {
      alert('Kod ve açıklama zorunludur');
      return;
    }

    setSaving(true);
    try {
      const data = {
        standard_id: conditionStandardId,
        code: conditionForm.code,
        description: conditionForm.description,
        order_index: conditionForm.order_index
      };

      if (editingCondition) {
        const { error } = await supabase.from('ic_general_conditions').update(data).eq('id', editingCondition.id);
        if (error) throw error;
        alert('Genel şart güncellendi');
      } else {
        const { error } = await supabase.from('ic_general_conditions').insert(data);
        if (error) throw error;
        alert('Genel şart eklendi');
      }

      setShowConditionModal(false);
      setEditingCondition(null);
      setConditionForm({ code: '', description: '', order_index: 0 });
      await loadData();
    } catch (error: any) {
      alert(`Hata: ${error?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteCondition = async (id: string) => {
    if (!confirm('Genel şartı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase.from('ic_general_conditions').delete().eq('id', id);
      if (error) throw error;
      alert('Genel şart silindi');
      await loadData();
    } catch (error: any) {
      alert(`Hata: ${error?.message}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-slate-600">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          İç Kontrol Standartları ve Genel Şartlar
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Bileşenlere ait standartları ve genel şartları yönetin
        </p>
      </div>

      <div className="space-y-4">
        {components.map((component) => {
          const componentStandards = standards.filter(s => s.component_id === component.id);
          const isExpanded = expandedComponents.has(component.id);

          return (
            <div key={component.id} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 flex items-center justify-between bg-slate-50">
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedComponents);
                    if (isExpanded) {
                      newExpanded.delete(component.id);
                    } else {
                      newExpanded.add(component.id);
                    }
                    setExpandedComponents(newExpanded);
                  }}
                  className="flex items-center gap-3 flex-1"
                >
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <div className="text-left">
                    <div className="font-bold text-lg">{component.code} - {component.name}</div>
                    <div className="text-sm text-slate-600">{componentStandards.length} Standart</div>
                  </div>
                </button>
                <button
                  onClick={() => handleAddStandard(component.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Standart Ekle
                </button>
              </div>

              {isExpanded && (
                <div className="p-4 space-y-3">
                  {componentStandards.map((standard) => {
                    const standardConditions = conditions.filter(c => c.standard_id === standard.id);
                    const isStandardExpanded = expandedStandards.has(standard.id);

                    return (
                      <div key={standard.id} className="border rounded-lg">
                        <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedStandards);
                              if (isStandardExpanded) {
                                newExpanded.delete(standard.id);
                              } else {
                                newExpanded.add(standard.id);
                              }
                              setExpandedStandards(newExpanded);
                            }}
                            className="flex items-center gap-2 flex-1"
                          >
                            {isStandardExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <div className="text-left">
                              <div className="font-semibold">{standard.code} - {standard.name}</div>
                              <div className="text-xs text-slate-600">{standardConditions.length} Genel Şart</div>
                            </div>
                          </button>
                          <div className="flex gap-2">
                            <button onClick={() => handleAddCondition(standard.id)} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1">
                              <Plus className="w-3 h-3" />
                              Genel Şart
                            </button>
                            <button onClick={() => handleEditStandard(standard)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteStandard(standard.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isStandardExpanded && (
                          <div className="p-3 space-y-2">
                            {standardConditions.length === 0 ? (
                              <div className="text-sm text-slate-500 text-center py-2">Henüz genel şart eklenmemiş</div>
                            ) : (
                              standardConditions.map((condition) => (
                                <div key={condition.id} className="flex items-start justify-between p-2 bg-white border rounded hover:bg-slate-50">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{condition.code}</div>
                                    <div className="text-xs text-slate-600 mt-1">{condition.description}</div>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <button onClick={() => handleEditCondition(condition)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => deleteCondition(condition.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {componentStandards.length === 0 && (
                    <div className="text-sm text-slate-500 text-center py-4">Henüz standart eklenmemiş</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={showStandardModal} onClose={() => { setShowStandardModal(false); setEditingStandard(null); }} title={editingStandard ? 'Standart Düzenle' : 'Yeni Standart Ekle'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod <span className="text-red-500">*</span></label>
            <input type="text" value={standardForm.code} onChange={(e) => setStandardForm({ ...standardForm, code: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">İsim <span className="text-red-500">*</span></label>
            <input type="text" value={standardForm.name} onChange={(e) => setStandardForm({ ...standardForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
            <textarea value={standardForm.description} onChange={(e) => setStandardForm({ ...standardForm, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sıra</label>
            <input type="number" value={standardForm.order_index} onChange={(e) => setStandardForm({ ...standardForm, order_index: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button onClick={() => { setShowStandardModal(false); setEditingStandard(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">İptal</button>
            <button onClick={saveStandard} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showConditionModal} onClose={() => { setShowConditionModal(false); setEditingCondition(null); }} title={editingCondition ? 'Genel Şart Düzenle' : 'Yeni Genel Şart Ekle'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod <span className="text-red-500">*</span></label>
            <input type="text" value={conditionForm.code} onChange={(e) => setConditionForm({ ...conditionForm, code: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Örn: GŞ.1.1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama <span className="text-red-500">*</span></label>
            <textarea value={conditionForm.description} onChange={(e) => setConditionForm({ ...conditionForm, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={4} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sıra</label>
            <input type="number" value={conditionForm.order_index} onChange={(e) => setConditionForm({ ...conditionForm, order_index: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button onClick={() => { setShowConditionModal(false); setEditingCondition(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">İptal</button>
            <button onClick={saveCondition} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
