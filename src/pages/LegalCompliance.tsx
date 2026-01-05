import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Scale, FileText, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ComplianceRequirement {
  id: string;
  requirement_code: string;
  requirement_title: string;
  compliance_status: string;
  compliance_deadline: string | null;
  legal_regulation: {
    regulation_code: string;
    regulation_title: string;
  };
  responsible_department: {
    name: string;
  } | null;
}

export default function LegalCompliance() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (organization?.id) {
      fetchRequirements();
    }
  }, [organization?.id]);

  const fetchRequirements = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('compliance_requirements')
        .select(`
          *,
          legal_regulation:legal_regulations!legal_regulation_id(regulation_code, regulation_title),
          responsible_department:departments!responsible_department_id(name)
        `)
        .eq('organization_id', organization?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequirements(data || []);
    } catch (error) {
      console.error('Error fetching requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800';
      case 'partially_compliant': return 'bg-yellow-100 text-yellow-800';
      case 'non_compliant': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'not_applicable': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Beklemede',
      'compliant': 'Uyumlu',
      'partially_compliant': 'Kısmen Uyumlu',
      'non_compliant': 'Uyumsuz',
      'not_applicable': 'Uygulanmaz'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'partially_compliant':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'non_compliant':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const filteredRequirements = requirements.filter(req =>
    statusFilter === 'all' || req.compliance_status === statusFilter
  );

  const stats = {
    total: requirements.length,
    compliant: requirements.filter(r => r.compliance_status === 'compliant').length,
    partiallyCompliant: requirements.filter(r => r.compliance_status === 'partially_compliant').length,
    nonCompliant: requirements.filter(r => r.compliance_status === 'non_compliant').length,
    pending: requirements.filter(r => r.compliance_status === 'pending').length
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Yasal Uyumluluk Yönetimi</h1>
            <p className="mt-2 text-gray-600">
              Mevzuat takibi ve uyumluluk değerlendirmeleri
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Gereksinim</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <Scale className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uyumlu</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.compliant}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kısmen Uyumlu</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.partiallyCompliant}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uyumsuz</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.nonCompliant}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Beklemede</p>
                <p className="text-3xl font-bold text-gray-600 mt-2">{stats.pending}</p>
              </div>
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Uyumluluk Gereksinimleri</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="pending">Beklemede</option>
                <option value="compliant">Uyumlu</option>
                <option value="partially_compliant">Kısmen Uyumlu</option>
                <option value="non_compliant">Uyumsuz</option>
                <option value="not_applicable">Uygulanmaz</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
            ) : filteredRequirements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {statusFilter !== 'all' ? 'Seçilen durumda gereksinim bulunamadı' : 'Henüz uyumluluk gereksinimi tanımlanmamış'}
              </div>
            ) : (
              filteredRequirements.map((req) => (
                <div key={req.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(req.compliance_status)}
                        <h3 className="text-lg font-semibold">{req.requirement_title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(req.compliance_status)}`}>
                          {getStatusLabel(req.compliance_status)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Gereksinim Kodu</p>
                          <p className="text-sm font-medium">{req.requirement_code}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">İlgili Mevzuat</p>
                          <p className="text-sm font-medium">{req.legal_regulation?.regulation_code || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Sorumlu Birim</p>
                          <p className="text-sm font-medium">{req.responsible_department?.name || 'Atanmadı'}</p>
                        </div>
                        {req.compliance_deadline && (
                          <div>
                            <p className="text-xs text-gray-500">Son Tarih</p>
                            <p className="text-sm font-medium">
                              {new Date(req.compliance_deadline).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                        )}
                      </div>

                      {req.legal_regulation && (
                        <div className="mt-3 text-sm text-gray-600">
                          {req.legal_regulation.regulation_title}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}