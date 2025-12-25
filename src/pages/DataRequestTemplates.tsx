import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Copy, Power, PowerOff, ArrowUp, ArrowDown } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

interface TemplateField {
  id: string;
  template_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  field_order: number;
  placeholder: string;
  help_text: string;
  field_options: any[];
  default_value: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Kısa Metin' },
  { value: 'textarea', label: 'Uzun Metin' },
  { value: 'number', label: 'Sayı' },
  { value: 'date', label: 'Tarih' },
  { value: 'datetime', label: 'Tarih ve Saat' },
  { value: 'select', label: 'Açılır Liste (Tek Seçim)' },
  { value: 'multi_select', label: 'Çoklu Seçim' },
  { value: 'checkbox', label: 'Onay Kutusu' },
  { value: 'file', label: 'Dosya Yükleme' },
  { value: 'email', label: 'E-posta' },
  { value: 'phone', label: 'Telefon' },
  { value: 'url', label: 'URL' },
];

export default function DataRequestTemplates() {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<TemplateField | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: '',
    is_active: true,
  });

  const [fieldForm, setFieldForm] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    placeholder: '',
    help_text: '',
    field_options: [] as string[],
    default_value: '',
  });

  useEffect(() => {
    loadTemplates();
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedTemplate) {
      loadFields(selectedTemplate.id);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('data_request_templates')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from('data_request_template_fields')
        .select('*')
        .eq('template_id', templateId)
        .order('field_order', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error: any) {
      console.error('Error loading fields:', error);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (selectedTemplate) {
        const { error } = await supabase
          .from('data_request_templates')
          .update(templateForm)
          .eq('id', selectedTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('data_request_templates')
          .insert({
            ...templateForm,
            organization_id: profile?.organization_id,
            created_by: user?.id,
          });

        if (error) throw error;
      }

      setShowTemplateModal(false);
      loadTemplates();
      resetTemplateForm();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleSaveField = async () => {
    try {
      if (!selectedTemplate) return;

      const fieldData = {
        template_id: selectedTemplate.id,
        field_name: fieldForm.field_name,
        field_label: fieldForm.field_label,
        field_type: fieldForm.field_type,
        is_required: fieldForm.is_required,
        placeholder: fieldForm.placeholder,
        help_text: fieldForm.help_text,
        field_options: fieldForm.field_options,
        default_value: fieldForm.default_value,
        field_order: editingField ? editingField.field_order : fields.length,
      };

      if (editingField) {
        const { error } = await supabase
          .from('data_request_template_fields')
          .update(fieldData)
          .eq('id', editingField.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('data_request_template_fields')
          .insert(fieldData);

        if (error) throw error;
      }

      setShowFieldModal(false);
      loadFields(selectedTemplate.id);
      resetFieldForm();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Bu alanı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('data_request_template_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      if (selectedTemplate) loadFields(selectedTemplate.id);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleMoveField = async (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(f => f.id === fieldId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === fields.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newFields = [...fields];
    [newFields[currentIndex], newFields[newIndex]] = [newFields[newIndex], newFields[currentIndex]];

    try {
      const updates = newFields.map((field, index) => ({
        id: field.id,
        field_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('data_request_template_fields')
          .update({ field_order: update.field_order })
          .eq('id', update.id);
      }

      if (selectedTemplate) loadFields(selectedTemplate.id);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleToggleActive = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('data_request_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;
      loadTemplates();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('data_request_templates')
        .insert({
          name: template.name + ' (Kopya)',
          description: template.description,
          category: template.category,
          is_active: false,
          organization_id: profile?.organization_id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const { data: templateFields, error: fieldsError } = await supabase
        .from('data_request_template_fields')
        .select('*')
        .eq('template_id', template.id);

      if (fieldsError) throw fieldsError;

      if (templateFields && templateFields.length > 0) {
        const newFields = templateFields.map(field => ({
          template_id: newTemplate.id,
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          is_required: field.is_required,
          field_order: field.field_order,
          placeholder: field.placeholder,
          help_text: field.help_text,
          field_options: field.field_options,
          default_value: field.default_value,
        }));

        const { error: insertError } = await supabase
          .from('data_request_template_fields')
          .insert(newFields);

        if (insertError) throw insertError;
      }

      loadTemplates();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      category: '',
      is_active: true,
    });
    setSelectedTemplate(null);
  };

  const resetFieldForm = () => {
    setFieldForm({
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      placeholder: '',
      help_text: '',
      field_options: [],
      default_value: '',
    });
    setEditingField(null);
  };

  const openTemplateModal = (template?: Template) => {
    if (template) {
      setSelectedTemplate(template);
      setTemplateForm({
        name: template.name,
        description: template.description,
        category: template.category,
        is_active: template.is_active,
      });
    } else {
      resetTemplateForm();
    }
    setShowTemplateModal(true);
  };

  const openFieldModal = (field?: TemplateField) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        is_required: field.is_required,
        placeholder: field.placeholder || '',
        help_text: field.help_text || '',
        field_options: field.field_options || [],
        default_value: field.default_value || '',
      });
    } else {
      resetFieldForm();
    }
    setShowFieldModal(true);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Şablonları</h1>
          <p className="mt-1 text-sm text-gray-500">
            Veri talepleriniz için hazır form şablonları oluşturun
          </p>
        </div>
        <button
          onClick={() => openTemplateModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Şablon
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900">Şablonlar</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {templates.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Henüz şablon oluşturulmamış
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      selectedTemplate?.id === template.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            {template.name}
                          </h4>
                          {template.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Pasif
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        {template.category && (
                          <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {template.category}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTemplateModal(template);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTemplate(template);
                          }}
                          className="p-1 text-gray-400 hover:text-green-600"
                          title="Kopyala"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(template);
                          }}
                          className="p-1 text-gray-400 hover:text-yellow-600"
                          title={template.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                        >
                          {template.is_active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Form Alanları</h3>
                <button
                  onClick={() => openFieldModal()}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Alan Ekle
                </button>
              </div>
              <div className="p-4 space-y-3">
                {fields.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    Bu şablona henüz alan eklenmemiş.
                    <br />
                    <button
                      onClick={() => openFieldModal()}
                      className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      İlk alanı ekleyin
                    </button>
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">
                              #{index + 1}
                            </span>
                            <h4 className="text-sm font-medium text-gray-900">
                              {field.field_label}
                            </h4>
                            {field.is_required && (
                              <span className="text-red-500 text-xs">*</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                            </span>
                            {field.placeholder && (
                              <span className="text-gray-400">
                                Placeholder: {field.placeholder}
                              </span>
                            )}
                          </div>
                          {field.help_text && (
                            <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>
                          )}
                          {field.field_options && field.field_options.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {field.field_options.map((option: string, i: number) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-4">
                          <button
                            onClick={() => handleMoveField(field.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleMoveField(field.id, 'down')}
                            disabled={index === fields.length - 1}
                            className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openFieldModal(field)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
              <p>Düzenlemek için soldan bir şablon seçin</p>
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedTemplate ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Şablon Adı *
                </label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Örn: Envanter Formu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Açıklama
                </label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Şablon açıklaması..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kategori
                </label>
                <input
                  type="text"
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Örn: Envanter, Personel, Finansal"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={templateForm.is_active}
                  onChange={(e) => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Şablon aktif
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showFieldModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingField ? 'Alanı Düzenle' : 'Yeni Alan Ekle'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Alan Adı (Sistem) *
                  </label>
                  <input
                    type="text"
                    value={fieldForm.field_name}
                    onChange={(e) => setFieldForm({ ...fieldForm, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="envanter_no"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Alan Etiketi *
                  </label>
                  <input
                    type="text"
                    value={fieldForm.field_label}
                    onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Envanter Numarası"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Alan Türü *
                </label>
                <select
                  value={fieldForm.field_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Placeholder Metni
                </label>
                <input
                  type="text"
                  value={fieldForm.placeholder}
                  onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Kullanıcıya gösterilecek örnek"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Yardım Metni
                </label>
                <input
                  type="text"
                  value={fieldForm.help_text}
                  onChange={(e) => setFieldForm({ ...fieldForm, help_text: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Alan hakkında açıklama"
                />
              </div>

              {(fieldForm.field_type === 'select' || fieldForm.field_type === 'multi_select') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Seçenekler (Her satıra bir tane)
                  </label>
                  <textarea
                    value={fieldForm.field_options.join('\n')}
                    onChange={(e) => setFieldForm({ ...fieldForm, field_options: e.target.value.split('\n').filter(o => o.trim()) })}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Seçenek 1&#10;Seçenek 2&#10;Seçenek 3"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Varsayılan Değer
                </label>
                <input
                  type="text"
                  value={fieldForm.default_value}
                  onChange={(e) => setFieldForm({ ...fieldForm, default_value: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_required"
                  checked={fieldForm.is_required}
                  onChange={(e) => setFieldForm({ ...fieldForm, is_required: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_required" className="ml-2 block text-sm text-gray-700">
                  Zorunlu alan
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowFieldModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveField}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}