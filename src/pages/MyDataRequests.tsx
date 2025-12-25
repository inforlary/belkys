import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCircle, FileText, Send, Save, AlertCircle } from 'lucide-react';

interface Assignment {
  id: string;
  request_id: string;
  status: string;
  due_date: string;
  viewed_at: string;
  request: {
    id: string;
    title: string;
    description: string;
    priority: string;
    deadline: string;
    status: string;
  };
}

interface FormField {
  id: string;
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

interface Submission {
  id: string;
  status: string;
  version: number;
  submitted_at: string;
  reviewed_at: string;
  review_notes: string;
}

export default function MyDataRequests() {
  const { user, profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadAssignments();
  }, [profile?.department_id]);

  useEffect(() => {
    if (selectedAssignment) {
      loadFormFields(selectedAssignment.request_id);
      loadExistingSubmission(selectedAssignment.id);
      markAsViewed(selectedAssignment.id);
    }
  }, [selectedAssignment]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('data_request_assignments')
        .select(`
          *,
          data_requests!inner(*)
        `)
        .or(`department_id.eq.${profile?.department_id},assigned_to.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((assignment: any) => ({
        ...assignment,
        request: assignment.data_requests,
      }));

      setAssignments(formattedData);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFormFields = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('data_request_custom_fields')
        .select('*')
        .eq('request_id', requestId)
        .order('field_order', { ascending: true });

      if (error) throw error;
      setFormFields(data || []);

      const initialValues: Record<string, any> = {};
      (data || []).forEach((field: FormField) => {
        initialValues[field.field_name] = field.default_value || '';
      });
      setFormValues(initialValues);
    } catch (error: any) {
      console.error('Error loading form fields:', error);
    }
  };

  const loadExistingSubmission = async (assignmentId: string) => {
    try {
      const { data: submissions, error } = await supabase
        .from('data_request_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('version', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (submissions && submissions.length > 0) {
        const submission = submissions[0];
        setExistingSubmission(submission);

        const { data: values, error: valuesError } = await supabase
          .from('data_request_submission_values')
          .select('*')
          .eq('submission_id', submission.id);

        if (valuesError) throw valuesError;

        const loadedValues: Record<string, any> = {};
        (values || []).forEach((value: any) => {
          if (value.field_type === 'number') {
            loadedValues[value.field_name] = value.value_number;
          } else if (value.field_type === 'date' || value.field_type === 'datetime') {
            loadedValues[value.field_name] = value.value_date;
          } else if (value.field_type === 'checkbox') {
            loadedValues[value.field_name] = value.value_boolean;
          } else if (value.field_type === 'multi_select') {
            loadedValues[value.field_name] = value.value_json;
          } else {
            loadedValues[value.field_name] = value.value_text;
          }
        });

        setFormValues(loadedValues);
      }
    } catch (error: any) {
      console.error('Error loading submission:', error);
    }
  };

  const markAsViewed = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('data_request_assignments')
        .update({
          viewed_at: new Date().toISOString(),
          status: 'viewed',
        })
        .eq('id', assignmentId)
        .is('viewed_at', null);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error marking as viewed:', error);
    }
  };

  const handleSaveSubmission = async (submitNow: boolean = false) => {
    try {
      setSaving(true);

      if (submitNow) {
        const requiredFields = formFields.filter(f => f.is_required);
        for (const field of requiredFields) {
          if (!formValues[field.field_name]) {
            alert(`Lütfen "${field.field_label}" alanını doldurun.`);
            return;
          }
        }
      }

      let submissionId = existingSubmission?.id;

      if (!submissionId) {
        const { data: newSubmission, error: submissionError } = await supabase
          .from('data_request_submissions')
          .insert({
            assignment_id: selectedAssignment?.id,
            request_id: selectedAssignment?.request_id,
            submitted_by: user?.id,
            department_id: profile?.department_id,
            status: submitNow ? 'submitted' : 'draft',
            submitted_at: submitNow ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (submissionError) throw submissionError;
        submissionId = newSubmission.id;
      } else {
        const { error: updateError } = await supabase
          .from('data_request_submissions')
          .update({
            status: submitNow ? 'submitted' : 'draft',
            submitted_at: submitNow ? new Date().toISOString() : null,
          })
          .eq('id', submissionId);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('data_request_submission_values')
          .delete()
          .eq('submission_id', submissionId);

        if (deleteError) throw deleteError;
      }

      const valuesToInsert = formFields.map(field => {
        const value = formValues[field.field_name];
        const valueData: any = {
          submission_id: submissionId,
          field_id: field.id,
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
        };

        if (field.field_type === 'number') {
          valueData.value_number = value ? parseFloat(value) : null;
        } else if (field.field_type === 'date' || field.field_type === 'datetime') {
          valueData.value_date = value || null;
        } else if (field.field_type === 'checkbox') {
          valueData.value_boolean = !!value;
        } else if (field.field_type === 'multi_select') {
          valueData.value_json = value || [];
        } else {
          valueData.value_text = value || null;
        }

        return valueData;
      });

      const { error: valuesError } = await supabase
        .from('data_request_submission_values')
        .insert(valuesToInsert);

      if (valuesError) throw valuesError;

      if (submitNow) {
        const { error: assignmentError } = await supabase
          .from('data_request_assignments')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', selectedAssignment?.id);

        if (assignmentError) throw assignmentError;
      }

      alert(submitNow ? 'Form başarıyla gönderildi!' : 'Taslak olarak kaydedildi.');
      setSelectedAssignment(null);
      loadAssignments();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderFormField = (field: FormField) => {
    const value = formValues[field.field_name] || '';

    const handleChange = (newValue: any) => {
      setFormValues({ ...formValues, [field.field_name]: newValue });
    };

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.field_type === 'text' ? 'text' : field.field_type}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center mt-1">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 text-sm text-gray-700">
              {field.help_text || field.field_label}
            </label>
          </div>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          >
            <option value="">Seçiniz...</option>
            {(field.field_options || []).map((option: string, index: number) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'multi_select':
        return (
          <div className="mt-1 space-y-2">
            {(field.field_options || []).map((option: string, index: number) => (
              <label key={index} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(value || []).includes(option)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter((v: string) => v !== option);
                    handleChange(newValues);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'file':
        return (
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleChange(file.name);
              }
            }}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required={field.is_required}
          />
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Bekliyor', icon: Clock },
      viewed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Görüntülendi', icon: FileText },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Devam Ediyor', icon: Clock },
      submitted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Gönderildi', icon: CheckCircle },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Tamamlandı', icon: CheckCircle },
    };

    const badge = badges[status] || badges.pending;
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

    return badges[priority] || badges.normal;
  };

  const filteredAssignments = statusFilter === 'all'
    ? assignments
    : assignments.filter(a => a.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (selectedAssignment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setSelectedAssignment(null)}
              className="text-sm text-blue-600 hover:text-blue-700 mb-2"
            >
              ← Taleplere Dön
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedAssignment.request.title}
            </h1>
            {selectedAssignment.request.description && (
              <p className="mt-1 text-sm text-gray-500">
                {selectedAssignment.request.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {getPriorityBadge(selectedAssignment.request.priority) && (
              <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${getPriorityBadge(selectedAssignment.request.priority).bg} ${getPriorityBadge(selectedAssignment.request.priority).text}`}>
                {getPriorityBadge(selectedAssignment.request.priority).label}
              </span>
            )}
            {selectedAssignment.due_date && (
              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-700">
                <Clock className="h-4 w-4 mr-1" />
                Son: {new Date(selectedAssignment.due_date).toLocaleDateString('tr-TR')}
              </span>
            )}
          </div>
        </div>

        {existingSubmission && existingSubmission.status === 'revision_requested' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Revizyon İstendi</h3>
                {existingSubmission.review_notes && (
                  <p className="mt-1 text-sm text-yellow-700">
                    {existingSubmission.review_notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Form Alanları</h2>
          </div>
          <div className="px-6 py-4 space-y-6">
            {formFields.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                Bu talep için form alanları tanımlanmamış.
              </div>
            ) : (
              formFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700">
                    {field.field_label}
                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.help_text && field.field_type !== 'checkbox' && (
                    <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>
                  )}
                  {renderFormField(field)}
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => handleSaveSubmission(false)}
              disabled={saving || existingSubmission?.status === 'submitted'}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Kaydediliyor...' : 'Taslak Kaydet'}
            </button>
            <button
              onClick={() => handleSaveSubmission(true)}
              disabled={saving || existingSubmission?.status === 'submitted'}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4 mr-2" />
              {saving ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Veri Taleplerim</h1>
        <p className="mt-1 text-sm text-gray-500">
          Size atanan veri taleplerini görüntüleyin ve doldurun
        </p>
      </div>

      <div className="flex gap-2">
        {['all', 'pending', 'viewed', 'in_progress', 'submitted'].map((status) => (
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
        <ul className="divide-y divide-gray-200">
          {filteredAssignments.length === 0 ? (
            <li className="px-6 py-8 text-center text-sm text-gray-500">
              Henüz size atanmış talep bulunmuyor
            </li>
          ) : (
            filteredAssignments.map((assignment) => (
              <li
                key={assignment.id}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedAssignment(assignment)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-gray-900">
                        {assignment.request.title}
                      </h3>
                      {getStatusBadge(assignment.status)}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(assignment.request.priority).bg} ${getPriorityBadge(assignment.request.priority).text}`}>
                        {getPriorityBadge(assignment.request.priority).label}
                      </span>
                    </div>
                    {assignment.request.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-1">
                        {assignment.request.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      {assignment.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Son: {new Date(assignment.due_date).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                      {assignment.viewed_at && (
                        <span>
                          Görüntülenme: {new Date(assignment.viewed_at).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Görüntüle →
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}