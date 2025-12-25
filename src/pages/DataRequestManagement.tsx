import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Send, Eye, Edit2, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DataRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  created_at: string;
  sent_at: string;
  template_name?: string;
  assignment_count?: number;
  submitted_count?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Department {
  id: string;
  name: string;
}

export default function DataRequestManagement() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);

  const [requestForm, setRequestForm] = useState({
    template_id: '',
    title: '',
    description: '',
    priority: 'normal',
    deadline: '',
    selectedDepartments: [] as string[],
    selectAll: false,
  });

  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [profile?.organization_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRequests(),
        loadTemplates(),
        loadDepartments(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('data_requests')
        .select(`
          *,
          data_request_templates(name),
          data_request_assignments(
            id,
            status,
            data_request_submissions(id, status)
          )
        `)
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((req: any) => ({
        ...req,
        template_name: req.data_request_templates?.name,
        assignment_count: req.data_request_assignments?.length || 0,
        submitted_count: req.data_request_assignments?.filter((a: any) =>
          a.data_request_submissions?.some((s: any) => s.status === 'submitted' || s.status === 'approved')
        ).length || 0,
      }));

      setRequests(formattedData);
    } catch (error: any) {
      console.error('Error loading requests:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('data_request_templates')
        .select('id, name, description, category')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error loading departments:', error);
    }
  };

  const handleCreateRequest = async () => {
    try {
      if (!requestForm.title || requestForm.selectedDepartments.length === 0) {
        alert('Lütfen başlık ve en az bir müdürlük seçin.');
        return;
      }

      const { data: newRequest, error: requestError } = await supabase
        .from('data_requests')
        .insert({
          organization_id: profile?.organization_id,
          template_id: requestForm.template_id || null,
          title: requestForm.title,
          description: requestForm.description,
          priority: requestForm.priority,
          deadline: requestForm.deadline || null,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      const assignments = requestForm.selectedDepartments.map(deptId => ({
        request_id: newRequest.id,
        department_id: deptId,
        status: 'pending',
        due_date: requestForm.deadline || null,
      }));

      const { error: assignmentError } = await supabase
        .from('data_request_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      if (requestForm.template_id) {
        const { data: templateFields, error: fieldsError } = await supabase
          .from('data_request_template_fields')
          .select('*')
          .eq('template_id', requestForm.template_id);

        if (fieldsError) throw fieldsError;

        if (templateFields && templateFields.length > 0) {
          const customFields = templateFields.map(field => ({
            request_id: newRequest.id,
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

          const { error: customFieldsError } = await supabase
            .from('data_request_custom_fields')
            .insert(customFields);

          if (customFieldsError) throw customFieldsError;
        }
      }

      setShowCreateModal(false);
      resetForm();
      loadRequests();
      alert('Veri talebi başarıyla oluşturuldu!');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleSendRequest = async (requestId: string) => {
    if (!confirm('Bu talebi göndermek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('data_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      loadRequests();
      alert('Talep başarıyla gönderildi!');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Bu talebi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('data_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      loadRequests();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const resetForm = () => {
    setRequestForm({
      template_id: '',
      title: '',
      description: '',
      priority: 'normal',
      deadline: '',
      selectedDepartments: [],
      selectAll: false,
    });
  };

  const handleSelectAllDepartments = (checked: boolean) => {
    setRequestForm({
      ...requestForm,
      selectAll: checked,
      selectedDepartments: checked ? departments.map(d => d.id) : [],
    });
  };

  const handleToggleDepartment = (deptId: string) => {
    const newSelected = requestForm.selectedDepartments.includes(deptId)
      ? requestForm.selectedDepartments.filter(id => id !== deptId)
      : [...requestForm.selectedDepartments, deptId];

    setRequestForm({
      ...requestForm,
      selectedDepartments: newSelected,
      selectAll: newSelected.length === departments.length,
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Taslak', icon: Edit2 },
      sent: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Gönderildi', icon: Send },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Devam Ediyor', icon: Clock },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Tamamlandı', icon: CheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'İptal', icon: XCircle },
    };

    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      low: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Düşük' },
      normal: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Normal' },
      high: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Yüksek' },
      urgent: { bg: 'bg-red-100', text: 'text-red-800', label: 'Acil' },
    };

    const badge = badges[priority] || badges.normal;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

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
          <h1 className="text-2xl font-bold text-gray-900">Veri Talepleri</h1>
          <p className="mt-1 text-sm text-gray-500">
            Müdürlüklerden veri toplayın ve takip edin
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Talep Oluştur
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              statusFilter === status
                ? 'bg-blue-100 text-blue-700'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {status === 'all' ? 'Tümü' : getStatusBadge(status).props.children[1]}
          </button>
        ))}
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Talep
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Öncelik
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                İlerleme
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Son Tarih
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  Henüz talep oluşturulmamış
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {request.title}
                      </div>
                      {request.template_name && (
                        <div className="text-xs text-gray-500 mt-1">
                          Şablon: {request.template_name}
                        </div>
                      )}
                      {request.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {request.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPriorityBadge(request.priority)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${request.assignment_count > 0 ? (request.submitted_count / request.assignment_count) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {request.submitted_count}/{request.assignment_count}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.deadline ? (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(request.deadline).toLocaleDateString('tr-TR')}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {request.status === 'draft' && (
                        <button
                          onClick={() => handleSendRequest(request.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Gönder"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowDetailModal(true);
                        }}
                        className="text-gray-600 hover:text-gray-900"
                        title="Görüntüle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {request.status === 'draft' && (
                        <button
                          onClick={() => handleDeleteRequest(request.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Yeni Veri Talebi Oluştur
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Şablon Seç (Opsiyonel)
                </label>
                <select
                  value={requestForm.template_id}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value);
                    setRequestForm({
                      ...requestForm,
                      template_id: e.target.value,
                      title: template ? template.name : requestForm.title,
                      description: template ? template.description : requestForm.description,
                    });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Özel Form (Şablonsuz)</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.category && `(${template.category})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Talep Başlığı *
                </label>
                <input
                  type="text"
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Örn: 2024 Yılı Envanter Verileri"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Açıklama
                </label>
                <textarea
                  value={requestForm.description}
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Talep hakkında detaylı açıklama..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Öncelik
                  </label>
                  <select
                    value={requestForm.priority}
                    onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Son Tarih
                  </label>
                  <input
                    type="date"
                    value={requestForm.deadline}
                    onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gönderilecek Müdürlükler *
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-64 overflow-y-auto">
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={requestForm.selectAll}
                        onChange={(e) => handleSelectAllDepartments(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        Tümünü Seç
                      </span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    {departments.map((dept) => (
                      <label key={dept.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={requestForm.selectedDepartments.includes(dept.id)}
                          onChange={() => handleToggleDepartment(dept.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Seçili: {requestForm.selectedDepartments.length} müdürlük
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleCreateRequest}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}