import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import Modal from '../components/ui/Modal';

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

export default function ICStandardsManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [components, setComponents] = useState<Component[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [conditions, setConditions] = useState<GeneralCondition[]>([]);

  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  const [showStandardModal, setShowStandardModal] = useState(false);
  const [editingStandard, setEditingStandard] = useState<Standard | null>(null);
  const [standardForm, setStandardForm] = useState({
    component_id: '',
    code: '',
    name: '',
    description: ''
  });

  const [showConditionModal, setShowConditionModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState<GeneralCondition | null>(null);
  const [conditionForm, setConditionForm] = useState({
    standard_id: '',
    code: '',
    description: ''
  });

  const [deletingItem, setDeletingItem] = useState<{ type: 'standard' | 'condition'; item: any } | null>(null);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [componentsRes, standardsRes, conditionsRes] = await Promise.all([
        supabase
          .from('ic_components')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_standards')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_general_conditions')
          .select('*')
          .order('order_index')
      ]);

      if (componentsRes.data) setComponents(componentsRes.data);
      if (standardsRes.data) setStandards(standardsRes.data);
      if (conditionsRes.data) setConditions(conditionsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openStandardModal = (componentId: string, standard?: Standard) => {
    if (standard) {
      setEditingStandard(standard);
      setStandardForm({
        component_id: standard.component_id,
        code: standard.code,
        name: standard.name,
        description: standard.description
      });
    } else {
      setEditingStandard(null);
      const componentStandards = standards.filter(s => s.component_id === componentId);
      const nextOrderIndex = componentStandards.length + 1;
      const component = components.find(c => c.id === componentId);
      const nextCode = component ? `${component.code}.${nextOrderIndex}` : '';

      setStandardForm({
        component_id: componentId,
        code: nextCode,
        name: '',
        description: ''
      });
    }
    setShowStandardModal(true);
  };

  const saveStandard = async () => {
    if (!standardForm.code || !standardForm.name) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    setSaving(true);
    try {
      const standardData = {
        component_id: standardForm.component_id,
        code: standardForm.code,
        name: standardForm.name,
        description: standardForm.description,
        order_index: editingStandard?.order_index || standards.filter(s => s.component_id === standardForm.component_id).length + 1
      };

      if (editingStandard) {
        const { error } = await supabase
          .from('ic_standards')
          .update(standardData)
          .eq('id', editingStandard.id);

        if (error) throw error;
        alert('Standart başarıyla güncellendi!');
      } else {
        const { error } = await supabase
          .from('ic_standards')
          .insert(standardData);

        if (error) throw error;
        alert('Standart başarıyla eklendi!');
      }

      setShowStandardModal(false);
      setEditingStandard(null);
      loadData();
    } catch (error: any) {
      console.error('Error saving standard:', error);
      alert(`Standart kaydedilirken hata oluştu: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const openConditionModal = (standardId: string, condition?: GeneralCondition) => {
    if (condition) {
      setEditingCondition(condition);
      setConditionForm({
        standard_id: condition.standard_id,
        code: condition.code,
        description: condition.description
      });
    } else {
      setEditingCondition(null);
      const standardConditions = conditions.filter(c => c.standard_id === standardId);
      const nextOrderIndex = standardConditions.length + 1;
      const standard = standards.find(s => s.id === standardId);
      const nextCode = standard ? `${standard.code}.${nextOrderIndex}` : '';

      setConditionForm({
        standard_id: standardId,
        code: nextCode,
        description: ''
      });
    }
    setShowConditionModal(true);
  };

  const saveCondition = async () => {
    if (!conditionForm.code || !conditionForm.description) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    setSaving(true);
    try {
      const conditionData = {
        standard_id: conditionForm.standard_id,
        code: conditionForm.code,
        description: conditionForm.description,
        order_index: editingCondition?.order_index || conditions.filter(c => c.standard_id === conditionForm.standard_id).length + 1
      };

      if (editingCondition) {
        const { error } = await supabase
          .from('ic_general_conditions')
          .update(conditionData)
          .eq('id', editingCondition.id);

        if (error) throw error;
        alert('Genel şart başarıyla güncellendi!');
      } else {
        const { error } = await supabase
          .from('ic_general_conditions')
          .insert(conditionData);

        if (error) throw error;
        alert('Genel şart başarıyla eklendi!');
      }

      setShowConditionModal(false);
      setEditingCondition(null);
      loadData();
    } catch (error: any) {
      console.error('Error saving condition:', error);
      alert(`Genel şart kaydedilirken hata oluştu: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    setSaving(true);
    try {
      if (deletingItem.type === 'standard') {
        const { error } = await supabase
          .from('ic_standards')
          .delete()
          .eq('id', deletingItem.item.id);

        if (error) throw error;
        alert('Standart başarıyla silindi!');
      } else {
        const { error } = await supabase
          .from('ic_general_conditions')
          .delete()
          .eq('id', deletingItem.item.id);

        if (error) throw error;
        alert('Genel şart başarıyla silindi!');
      }

      setDeletingItem(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert(`Silme işlemi başarısız: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Yetki Gerekli</h3>
            <p className="text-sm text-yellow-800">
              Bu sayfaya erişim için admin yetkisi gereklidir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">İç Kontrol Standartları Yönetimi</h1>
          <p className="text-sm text-slate-600 mt-1">Standartlar ve genel şartları yönetin</p>
        </div>
      </div>

      <div className="space-y-4">
        {components.map((component) => {
          const componentStandards = standards.filter(s => s.component_id === component.id);
          const isExpanded = expandedComponents.has(component.id);

          return (
            <div key={component.id} className="bg-white rounded-lg shadow">
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
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="text-left">
                    <div className="font-bold text-lg text-slate-900">{component.code} - {component.name}</div>
                    <div className="text-sm text-slate-600">{componentStandards.length} Standart</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openStandardModal(component.id);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Standart Ekle
                </button>
              </button>

              {isExpanded && (
                <div className="px-6 pb-4 space-y-3">
                  {componentStandards.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>Henüz standart eklenmemiş</p>
                    </div>
                  ) : (
                    componentStandards.map((standard) => {
                      const standardConditions = conditions.filter(c => c.standard_id === standard.id);
                      const isStandardExpanded = expandedStandards.has(standard.id);

                      return (
                        <div key={standard.id} className="border border-slate-200 rounded-lg">
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
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              {isStandardExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <div className="flex-1">
                                <div className="font-semibold text-slate-900">{standard.code} - {standard.name}</div>
                                <div className="text-sm text-slate-600 mt-0.5">{standard.description}</div>
                                <div className="text-xs text-slate-500 mt-1">{standardConditions.length} Genel Şart</div>
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openStandardModal(component.id, standard)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Düzenle"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingItem({ type: 'standard', item: standard })}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openConditionModal(standard.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                              >
                                <Plus className="w-3 h-3" />
                                Genel Şart Ekle
                              </button>
                            </div>
                          </div>

                          {isStandardExpanded && (
                            <div className="p-4 space-y-2">
                              {standardConditions.length === 0 ? (
                                <div className="text-center py-6 text-slate-500">
                                  <p className="text-sm">Henüz genel şart eklenmemiş</p>
                                </div>
                              ) : (
                                standardConditions.map((condition) => (
                                  <div
                                    key={condition.id}
                                    className="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-slate-900 text-sm">{condition.code}</div>
                                      <div className="text-sm text-slate-700 mt-1">{condition.description}</div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                      <button
                                        onClick={() => openConditionModal(standard.id, condition)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                        title="Düzenle"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setDeletingItem({ type: 'condition', item: condition })}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        title="Sil"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showStandardModal}
        onClose={() => {
          setShowStandardModal(false);
          setEditingStandard(null);
        }}
        title={editingStandard ? 'Standart Düzenle' : 'Yeni Standart Ekle'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Standart Kodu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={standardForm.code}
              onChange={(e) => setStandardForm({ ...standardForm, code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="örn: KOS.1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Standart Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={standardForm.name}
              onChange={(e) => setStandardForm({ ...standardForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Standart adı"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={standardForm.description}
              onChange={(e) => setStandardForm({ ...standardForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Standart açıklaması"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowStandardModal(false);
                setEditingStandard(null);
              }}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              İptal
            </button>
            <button
              onClick={saveStandard}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showConditionModal}
        onClose={() => {
          setShowConditionModal(false);
          setEditingCondition(null);
        }}
        title={editingCondition ? 'Genel Şart Düzenle' : 'Yeni Genel Şart Ekle'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Şart Kodu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={conditionForm.code}
              onChange={(e) => setConditionForm({ ...conditionForm, code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="örn: KOS.1.1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Genel Şart <span className="text-red-500">*</span>
            </label>
            <textarea
              value={conditionForm.description}
              onChange={(e) => setConditionForm({ ...conditionForm, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Genel şart açıklaması"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowConditionModal(false);
                setEditingCondition(null);
              }}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              İptal
            </button>
            <button
              onClick={saveCondition}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      {deletingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {deletingItem.type === 'standard' ? 'Standart Sil' : 'Genel Şart Sil'}
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Bu {deletingItem.type === 'standard' ? 'standardı' : 'genel şartı'} silmek istediğinize emin misiniz?
                </p>
                <p className="text-sm text-red-600">
                  Bu işlem geri alınamaz ve ilgili tüm veriler silinecektir.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
