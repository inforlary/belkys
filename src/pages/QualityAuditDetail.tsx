import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft } from 'lucide-react';

export default function QualityAuditDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const auditId = currentPath.split('/').pop() || '';
  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auditId && profile?.organization_id) {
      loadAudit();
      loadFindings();
    }
  }, [auditId, profile?.organization_id]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quality_audits')
        .select(`
          *,
          lead_auditor:profiles(full_name),
          audited_department:departments(name),
          audited_process:quality_processes(code, name)
        `)
        .eq('id', auditId)
        .single();

      if (error) throw error;
      setAudit(data);
    } catch (error) {
      console.error('Error loading audit:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFindings = async () => {
    try {
      const { data, error } = await supabase
        .from('quality_audit_findings')
        .select('*')
        .eq('audit_id', auditId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFindings(data || []);
    } catch (error) {
      console.error('Error loading findings:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  if (!audit) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Tetkik bulunamadı</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/quality-management/audits')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{audit.audit_code} - {audit.title}</h1>
          <p className="text-gray-600 mt-1">{audit.audit_type}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tetkik Bilgileri</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Tetkik Kodu</label>
              <div className="text-gray-900">{audit.audit_code}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Kapsam</label>
              <div className="text-gray-900">{audit.scope || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tetkik Tarihi</label>
              <div className="text-gray-900">{audit.audit_date || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Baş Denetçi</label>
              <div className="text-gray-900">{audit.lead_auditor?.full_name || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Denetlenen Birim</label>
              <div className="text-gray-900">{audit.audited_department?.name || '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bulgular Özeti</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-red-50 rounded">
              <span className="text-sm text-gray-700">Uygunsuzluklar</span>
              <span className="font-semibold text-red-600">
                {findings.filter(f => f.finding_type === 'nonconformity').length}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
              <span className="text-sm text-gray-700">Gözlemler</span>
              <span className="font-semibold text-yellow-600">
                {findings.filter(f => f.finding_type === 'observation').length}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <span className="text-sm text-gray-700">İyileştirme Önerileri</span>
              <span className="font-semibold text-green-600">
                {findings.filter(f => f.finding_type === 'improvement').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bulgular</h2>
        {findings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Henüz bulgu eklenmemiş</div>
        ) : (
          <div className="space-y-4">
            {findings.map(finding => (
              <div key={finding.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      finding.finding_type === 'nonconformity' ? 'bg-red-100 text-red-800' :
                      finding.finding_type === 'observation' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {finding.finding_type === 'nonconformity' ? 'Uygunsuzluk' :
                       finding.finding_type === 'observation' ? 'Gözlem' : 'İyileştirme'}
                    </span>
                    {finding.severity && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                        {finding.severity}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-gray-900">{finding.description}</div>
                {finding.evidence && (
                  <div className="mt-2 text-sm text-gray-600">
                    <strong>Kanıt:</strong> {finding.evidence}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
