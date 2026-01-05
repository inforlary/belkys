import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
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

export default function QualityAudits() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<QualityAudit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (organization?.id) {
      fetchAudits();
    }
  }, [organization?.id]);

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
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kalite Denetimleri</h1>
            <p className="mt-2 text-gray-600">
              İç kalite denetimleri ve uygunsuzluk yönetimi
            </p>
          </div>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
  );
}