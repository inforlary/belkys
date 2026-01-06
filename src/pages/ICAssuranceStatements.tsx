import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Award } from 'lucide-react';

export default function ICAssuranceStatements() {
  const { profile } = useAuth();
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadStatements();
    }
  }, [profile?.organization_id]);

  const loadStatements = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_assurance_statements')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('organization_id', profile?.organization_id)
        .order('year', { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (error) {
      console.error('Beyanlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAssuranceBadge = (level: string) => {
    const badges: Record<string, string> = {
      FULL: 'bg-green-100 text-green-800',
      QUALIFIED: 'bg-yellow-100 text-yellow-800',
      ADVERSE: 'bg-red-100 text-red-800',
    };
    return badges[level] || 'bg-slate-100 text-slate-800';
  };

  const getAssuranceLabel = (level: string) => {
    const labels: Record<string, string> = {
      FULL: 'Tam Güvence',
      QUALIFIED: 'Şartlı Güvence',
      ADVERSE: 'Olumsuz Güvence',
    };
    return labels[level] || level;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Award className="w-8 h-8 text-yellow-600" />
          İç Kontrol Güvence Beyanları
        </h1>
        <p className="text-slate-600 mt-2">
          Yıllık iç kontrol güvence beyanlarını yönetin ve onaylayın
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {statements.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-500">Henüz güvence beyanı bulunmuyor</p>
          </div>
        ) : (
          statements.map((statement) => (
            <div key={statement.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {statement.year} Yılı - {statement.type === 'UNIT' ? 'Birim' : 'Üst Yönetici'} Beyanı
                    </h3>
                    {statement.department && (
                      <p className="text-sm text-slate-600 mt-1">{statement.department.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {statement.assurance_level && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getAssuranceBadge(statement.assurance_level)}`}>
                        {getAssuranceLabel(statement.assurance_level)}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      statement.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                      statement.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      statement.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {statement.status === 'PUBLISHED' ? 'Yayınlandı' :
                       statement.status === 'APPROVED' ? 'Onaylandı' :
                       statement.status === 'SUBMITTED' ? 'Gönderildi' :
                       'Taslak'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Beyan Eden</p>
                  <p className="text-slate-900">{statement.declarant_name}</p>
                  {statement.declarant_title && (
                    <p className="text-sm text-slate-600">{statement.declarant_title}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Beyan Tarihi</p>
                  <p className="text-slate-900">
                    {new Date(statement.declaration_date).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                {statement.conclusion_statement && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Sonuç Beyanı</p>
                    <p className="text-sm text-blue-800">{statement.conclusion_statement}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
