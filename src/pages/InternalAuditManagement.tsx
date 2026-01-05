import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { FileSearch, Calendar, CheckCircle, AlertTriangle, BarChart3, Users } from 'lucide-react';

interface AuditProgram {
  id: string;
  program_code: string;
  audit_title: string;
  audit_type: string;
  status: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  lead_auditor: {
    full_name: string;
  } | null;
  audit_universe: {
    entity_name: string;
  };
}

interface AuditFinding {
  id: string;
  finding_code: string;
  finding_title: string;
  finding_type: string;
  severity: string;
  status: string;
}

export default function InternalAuditManagement() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'programs' | 'findings'>('programs');
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);

  useEffect(() => {
    if (organization?.id) {
      fetchData();
    }
  }, [organization?.id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'programs') {
        const { data, error } = await supabase
          .from('internal_audit_programs')
          .select(`
            *,
            lead_auditor:profiles!lead_auditor_id(full_name),
            audit_universe:internal_audit_universe!audit_universe_id(entity_name)
          `)
          .eq('organization_id', organization?.id)
          .order('planned_start_date', { ascending: false });

        if (error) throw error;
        setPrograms(data || []);
      }

      if (activeTab === 'findings') {
        const { data, error } = await supabase
          .from('internal_audit_findings')
          .select('*')
          .eq('organization_id', organization?.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setFindings(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'closed': return 'bg-gray-400 text-white';
      case 'final_report': return 'bg-green-500 text-white';
      case 'draft_report': return 'bg-blue-500 text-white';
      case 'fieldwork_complete': return 'bg-purple-500 text-white';
      case 'in_progress': return 'bg-yellow-500 text-white';
      case 'planned': return 'bg-gray-300 text-gray-700';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'planned': 'Planlandı',
      'in_progress': 'Devam Ediyor',
      'fieldwork_complete': 'Saha Çalışması Tamamlandı',
      'draft_report': 'Taslak Rapor',
      'final_report': 'Final Rapor',
      'closed': 'Kapatıldı'
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'financial': 'Mali Denetim',
      'operational': 'Operasyonel Denetim',
      'compliance': 'Uyumluluk Denetimi',
      'it': 'BT Denetimi',
      'performance': 'Performans Denetimi',
      'special': 'Özel Denetim'
    };
    return labels[type] || type;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">İç Denetim Yönetimi</h1>
            <p className="mt-2 text-gray-600">
              İç denetim planları, programları ve bulguları
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Program</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{programs.length}</p>
              </div>
              <FileSearch className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Devam Eden</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">
                  {programs.filter(p => p.status === 'in_progress').length}
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tamamlanan</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {programs.filter(p => p.status === 'closed').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Bulgu</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{findings.length}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('programs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'programs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Denetim Programları
              </button>
              <button
                onClick={() => setActiveTab('findings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'findings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Denetim Bulguları
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'programs' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                ) : programs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Henüz denetim programı yok</div>
                ) : (
                  programs.map((program) => (
                    <div key={program.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold">{program.audit_title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(program.status)}`}>
                              {getStatusLabel(program.status)}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Program Kodu</p>
                              <p className="text-sm font-medium">{program.program_code}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Denetim Türü</p>
                              <p className="text-sm font-medium">{getTypeLabel(program.audit_type)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Denetim Evreni</p>
                              <p className="text-sm font-medium">{program.audit_universe?.entity_name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Baş Denetçi</p>
                              <p className="text-sm font-medium">{program.lead_auditor?.full_name || 'Atanmadı'}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              Plan: {new Date(program.planned_start_date).toLocaleDateString('tr-TR')} -
                              {new Date(program.planned_end_date).toLocaleDateString('tr-TR')}
                            </div>
                            {program.actual_start_date && (
                              <div className="flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                                Başladı: {new Date(program.actual_start_date).toLocaleDateString('tr-TR')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'findings' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                ) : findings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Henüz denetim bulgusu yok</div>
                ) : (
                  findings.map((finding) => (
                    <div key={finding.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold">{finding.finding_title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(finding.severity)}`}>
                              {finding.severity.toUpperCase()}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                            <span>Kod: {finding.finding_code}</span>
                            <span>Tür: {finding.finding_type}</span>
                            <span>Durum: {finding.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}