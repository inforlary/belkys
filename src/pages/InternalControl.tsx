import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ShieldCheck, BookOpen, ClipboardCheck, Scale, TrendingUp } from 'lucide-react';

export default function InternalControl() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalActions: 0,
    completedActions: 0,
    activeAssessments: 0,
    totalMeetings: 0,
    avgCompliance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadStats();
    }
  }, [profile?.organization_id]);

  const loadStats = async () => {
    try {
      const { data: actions } = await supabase
        .from('ic_actions')
        .select('id, status')
        .in('action_plan_id',
          supabase
            .from('ic_action_plans')
            .select('id')
            .eq('organization_id', profile?.organization_id)
        );

      const { data: assessments } = await supabase
        .from('ic_assessments')
        .select('id, compliance_level')
        .eq('organization_id', profile?.organization_id);

      const { data: meetings } = await supabase
        .from('ikyk_meetings')
        .select('id')
        .eq('organization_id', profile?.organization_id);

      const totalActions = actions?.length || 0;
      const completedActions = actions?.filter(a => a.status === 'COMPLETED').length || 0;
      const avgCompliance = assessments?.length
        ? Math.round(assessments.reduce((acc, a) => acc + (a.compliance_level || 0), 0) / assessments.length * 20)
        : 0;

      setStats({
        totalActions,
        completedActions,
        activeAssessments: assessments?.length || 0,
        totalMeetings: meetings?.length || 0,
        avgCompliance,
      });
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
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
          <ShieldCheck className="w-8 h-8 text-green-600" />
          İç Kontrol Dashboard
        </h1>
        <p className="text-slate-600 mt-2">
          Kamu İç Kontrol Standartları uyumluluk yönetimi
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Toplam Eylem</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalActions}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <ClipboardCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Tamamlanan</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedActions}</p>
              <p className="text-xs text-slate-500 mt-1">
                {stats.totalActions > 0 ? Math.round((stats.completedActions / stats.totalActions) * 100) : 0}% tamamlandı
              </p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Değerlendirme</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{stats.activeAssessments}</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <Scale className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Ortalama Uyum</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.avgCompliance}%</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            İç Kontrol Bileşenleri
          </h3>
          <div className="space-y-3">
            {[
              { code: 'KO', name: 'Kontrol Ortamı', color: 'bg-blue-500' },
              { code: 'RD', name: 'Risk Değerlendirme', color: 'bg-purple-500' },
              { code: 'KF', name: 'Kontrol Faaliyetleri', color: 'bg-green-500' },
              { code: 'BI', name: 'Bilgi ve İletişim', color: 'bg-yellow-500' },
              { code: 'IZ', name: 'İzleme', color: 'bg-red-500' },
            ].map((component) => (
              <div key={component.code} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-2 h-8 ${component.color} rounded`}></div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{component.name}</p>
                  <p className="text-xs text-slate-500">{component.code}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="bg-green-100 rounded-full p-2 flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">İç Kontrol Hakkında</h3>
              <p className="text-slate-700 mb-4">
                Kamu İç Kontrol Standartları Tebliği çerçevesinde 18 standart ve 5 bileşen üzerinden
                iç kontrol sistemini yönetin.
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>18 KOS Standardı ile uyumluluk değerlendirmesi</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>İç kontrol eylem planları oluşturma ve takibi</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>İKİYK toplantı yönetimi ve karar takibi</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>Güvence beyanı hazırlama ve onaylama</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
