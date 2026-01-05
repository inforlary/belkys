import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Building2, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ExternalAudit {
  id: string;
  audit_code: string;
  audit_title: string;
  audit_type: string;
  status: string;
  notification_date: string;
  final_report_date: string | null;
  total_findings: number;
  critical_findings: number;
  high_findings: number;
  external_audit_body: {
    body_name: string;
    body_type: string;
  };
}

export default function ExternalAuditManagement() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<ExternalAudit[]>([]);

  useEffect(() => {
    if (organization?.id) {
      fetchAudits();
    }
  }, [organization?.id]);

  const fetchAudits = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('external_audits')
        .select(`
          *,
          external_audit_body:external_audit_bodies!external_audit_body_id(body_name, body_type)
        `)
        .eq('organization_id', organization?.id)
        .order('notification_date', { ascending: false });

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
      case 'closed': return 'bg-gray-500 text-white';
      case 'final_report': return 'bg-green-500 text-white';
      case 'management_response': return 'bg-blue-500 text-white';
      case 'draft_report': return 'bg-yellow-500 text-white';
      case 'fieldwork': return 'bg-purple-500 text-white';
      case 'planning': return 'bg-indigo-500 text-white';
      case 'notified': return 'bg-gray-300 text-gray-700';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'notified': 'Bildirildi',
      'planning': 'Planlama',
      'fieldwork': 'Saha Çalışması',
      'draft_report': 'Taslak Rapor',
      'management_response': 'Yönetim Yanıtı',
      'final_report': 'Final Rapor',
      'closed': 'Kapatıldı'
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'financial': 'Mali Denetim',
      'compliance': 'Uyumluluk Denetimi',
      'performance': 'Performans Denetimi',
      'it': 'BT Denetimi',
      'special': 'Özel Denetim',
      'follow_up': 'Takip Denetimi'
    };
    return labels[type] || type;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dış Denetim Yönetimi</h1>
            <p className="mt-2 text-gray-600">
              Sayıştay, bağımsız denetim ve diğer dış denetim süreçleri
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Denetim</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{audits.length}</p>
              </div>
              <Building2 className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Devam Eden</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">
                  {audits.filter(a => !['closed', 'final_report'].includes(a.status)).length}
                </p>
              </div>
              <FileText className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Bulgu</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {audits.reduce((sum, a) => sum + a.total_findings, 0)}
                </p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kapatılan</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {audits.filter(a => a.status === 'closed').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
          ) : audits.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Henüz dış denetim kaydı yok</div>
          ) : (
            audits.map((audit) => (
              <div key={audit.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold">{audit.audit_title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(audit.status)}`}>
                        {getStatusLabel(audit.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Denetim Kodu</p>
                        <p className="text-sm font-medium">{audit.audit_code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Denetim Türü</p>
                        <p className="text-sm font-medium">{getTypeLabel(audit.audit_type)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Denetim Kurumu</p>
                        <p className="text-sm font-medium">{audit.external_audit_body?.body_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Bildirim Tarihi</p>
                        <p className="text-sm font-medium">
                          {new Date(audit.notification_date).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-gray-600">
                          <span className="font-semibold">{audit.critical_findings}</span> Kritik
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-gray-600">
                          <span className="font-semibold">{audit.high_findings}</span> Yüksek
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          <span className="font-semibold">{audit.total_findings}</span> Toplam Bulgu
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}