import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Modal from '../components/ui/Modal';
import { Search, Plus, Calendar, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';

interface QualityAudit {
  id: string;
  audit_code: string;
  audit_title: string;
  audit_type: string;
  planned_date: string;
  actual_date: string | null;
  status: string;
  conformities: number;
  minor_nonconformities: number;
  major_nonconformities: number;
  opportunities_for_improvement: number;
  auditee_department: {
    name: string;
  };
  auditor: {
    full_name: string;
  } | null;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
}

export default function QualityAudits() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audits, setAudits] = useState<QualityAudit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    audit_title: '',
    audit_type: 'process',
    planned_date: '',
    auditee_department_id: '',
    auditor_id: '',
    scope: '',
    status: 'planned'
  });

  useEffect(() => {
    if (organization?.id) {
      fetchAudits();
      fetchDepartments();
      fetchUsers();
    }
  }, [organization?.id]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization?.id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', organization?.id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAudits = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('quality_audits')
        .select(`
          *,
          auditee_department:departments!auditee_department_id(name),
          auditor:profiles!auditor_id(full_name)
        `)
        .eq('organization_id', organization?.id)
        .order('planned_date', { ascending: false });

      if (error) throw error;
      setAudits(data || []);
    } catch (error) {
      console.error('Error fetching audits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const { data: lastAudit } = await supabase
        .from('quality_audits')
        .select('audit_code')
        .eq('organization_id', organization?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let auditNumber = 1;
      if (lastAudit?.audit_code) {
        const match = lastAudit.audit_code.match(/KD-(\d+)/);
        if (match) {
          auditNumber = parseInt(match[1]) + 1;
        }
      }

      const audit_code = `KD-${auditNumber.toString().padStart(4, '0')}`;

      const { error } = await supabase
        .from('quality_audits')
        .insert({
          organization_id: organization?.id,
          audit_code,
          audit_title: form.audit_title,
          audit_type: form.audit_type,
          planned_date: form.planned_date,
          auditee_department_id: form.auditee_department_id,
          auditor_id: form.auditor_id || null,
          scope: form.scope,
          status: form.status,
          conformities: 0,
          minor_nonconformities: 0,
          major_nonconformities: 0,
          opportunities_for_improvement: 0
        });

      if (error) throw error;

      setShowModal(false);
      setForm({
        audit_title: '',
        audit_type: 'process',
        planned_date: '',
        auditee_department_id: '',
        auditor_id: '',
        scope: '',
        status: 'planned'
      });
      fetchAudits();
      alert('Kalite denetimi başarıyla oluşturuldu!');
    } catch (error) {
      console.error('Error creating audit:', error);
      alert('Kalite denetimi oluşturulurken hata oluştu!');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'planned': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'in_progress': return 'Devam Ediyor';
      case 'planned': return 'Planlandı';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'process': return 'Süreç Denetimi';
      case 'product': return 'Ürün Denetimi';
      case 'system': return 'Sistem Denetimi';
      case 'compliance': return 'Uyumluluk Denetimi';
      default: return type;
    }
  };

  const filteredAudits = audits.filter(audit => {
    const matchesSearch = audit.audit_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          audit.audit_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: audits.length,
    completed: audits.filter(a => a.status === 'completed').length,
    inProgress: audits.filter(a => a.status === 'in_progress').length,
    planned: audits.filter(a => a.status === 'planned').length
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kalite Denetimleri</h1>
            <p className="mt-2 text-gray-600">
              İç kalite denetimleri ve uygunsuzluk yönetimi
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Denetim
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Denetim</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <Search className="w-10 h-10 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tamamlanan</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Devam Eden</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.inProgress}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Planlanan</p>
                <p className="text-3xl font-bold text-gray-600 mt-2">{stats.planned}</p>
              </div>
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex-1 max-w-lg">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Denetim ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="planned">Planlandı</option>
                  <option value="in_progress">Devam Ediyor</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal Edildi</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
            ) : filteredAudits.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchTerm || statusFilter !== 'all' ? 'Arama kriterlerine uygun denetim bulunamadı' : 'Henüz denetim tanımlanmamış'}
              </div>
            ) : (
              filteredAudits.map((audit) => (
                <div key={audit.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">{audit.audit_title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(audit.status)}`}>
                          {getStatusLabel(audit.status)}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Denetim Kodu</p>
                          <p className="font-medium text-sm">{audit.audit_code}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Denetim Türü</p>
                          <p className="font-medium text-sm">{getTypeLabel(audit.audit_type)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Denetlenen Birim</p>
                          <p className="font-medium text-sm">{audit.auditee_department?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Denetçi</p>
                          <p className="font-medium text-sm">{audit.auditor?.full_name || 'Atanmadı'}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold">{audit.conformities}</span> Uygunluk
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold">{audit.minor_nonconformities}</span> Minör Uygunsuzluk
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold">{audit.major_nonconformities}</span> Majör Uygunsuzluk
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        Plan: {new Date(audit.planned_date).toLocaleDateString('tr-TR')}
                        {audit.actual_date && (
                          <span className="ml-4">
                            Gerçekleşen: {new Date(audit.actual_date).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Yeni Kalite Denetimi"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Denetim Başlığı *
            </label>
            <input
              type="text"
              value={form.audit_title}
              onChange={(e) => setForm({ ...form, audit_title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Denetim Türü *
              </label>
              <select
                value={form.audit_type}
                onChange={(e) => setForm({ ...form, audit_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="process">Süreç Denetimi</option>
                <option value="product">Ürün Denetimi</option>
                <option value="system">Sistem Denetimi</option>
                <option value="compliance">Uyumluluk Denetimi</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planlanan Tarih *
              </label>
              <input
                type="date"
                value={form.planned_date}
                onChange={(e) => setForm({ ...form, planned_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Denetlenecek Birim *
              </label>
              <select
                value={form.auditee_department_id}
                onChange={(e) => setForm({ ...form, auditee_department_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seçiniz...</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Denetçi
              </label>
              <select
                value={form.auditor_id}
                onChange={(e) => setForm({ ...form, auditor_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Denetim Kapsamı
            </label>
            <textarea
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Denetimin kapsamını açıklayınız..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durum *
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="planned">Planlandı</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
