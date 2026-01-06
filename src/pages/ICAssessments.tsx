import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Scale } from 'lucide-react';

export default function ICAssessments() {
  const { profile } = useAuth();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadAssessments();
    }
  }, [profile?.organization_id]);

  const loadAssessments = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_assessments')
        .select(`
          *,
          standard:ic_standards(code, name)
        `)
        .eq('organization_id', profile?.organization_id)
        .order('assessment_date', { ascending: false });

      if (error) throw error;
      setAssessments(data || []);
    } catch (error) {
      console.error('Değerlendirmeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceColor = (level: number) => {
    if (level >= 4) return 'text-green-600';
    if (level >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceLabel = (level: number) => {
    if (level === 5) return 'Tam Uyumlu';
    if (level === 4) return 'Büyük Ölçüde Uyumlu';
    if (level === 3) return 'Kısmen Uyumlu';
    if (level === 2) return 'Az Uyumlu';
    return 'Uyumsuz';
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
          <Scale className="w-8 h-8 text-purple-600" />
          İç Kontrol Değerlendirmeleri
        </h1>
        <p className="text-slate-600 mt-2">Standart bazlı uyumluluk değerlendirmeleri</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Standart</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dönem</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Uyum Seviyesi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarih</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Durum</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {assessments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Henüz değerlendirme bulunmuyor
                </td>
              </tr>
            ) : (
              assessments.map((assessment) => (
                <tr key={assessment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-slate-900">{assessment.standard?.name}</div>
                    <div className="text-xs text-slate-500">{assessment.standard?.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {assessment.assessment_period}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className={`text-2xl font-bold ${getComplianceColor(assessment.compliance_level)}`}>
                      {assessment.compliance_level}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {getComplianceLabel(assessment.compliance_level)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {new Date(assessment.assessment_date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      assessment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      assessment.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                      assessment.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {assessment.status === 'APPROVED' ? 'Onaylandı' :
                       assessment.status === 'SUBMITTED' ? 'Gönderildi' :
                       assessment.status === 'REJECTED' ? 'Reddedildi' :
                       'Taslak'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
