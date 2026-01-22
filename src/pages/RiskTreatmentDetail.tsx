import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save } from 'lucide-react';

interface Treatment {
  id: string;
  code: string;
  title: string;
  description: string;
  treatment_type: string;
  responsible_department_id: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  estimated_budget: number;
  progress_percent: number;
  status: string;
  risk_id: string;
  risk: {
    code: string;
    name: string;
  };
  responsible_department: {
    name: string;
  };
}

interface ProgressRecord {
  id: string;
  progress_percent: number;
  status: string;
  notes: string;
  created_at: string;
  updated_by: {
    full_name: string;
  };
}

const treatmentTypeLabels: Record<string, string> = {
  NEW_CONTROL: 'Yeni Kontrol',
  IMPROVE_CONTROL: 'Mevcut Kontrolü İyileştir',
  TRANSFER: 'Transfer',
  ACCEPT: 'Kabul',
  AVOID: 'Kaçın'
};

const statusLabels: Record<string, string> = {
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  DELAYED: 'Gecikti'
};

export default function RiskTreatmentDetail() {
  const { profile } = useAuth();
  const { getPathParam } = useLocation();
  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProgress, setNewProgress] = useState({
    progress_percent: 0,
    status: 'PLANNED',
    notes: ''
  });

  const treatmentId = getPathParam();

  useEffect(() => {
    if (treatmentId && profile?.organization_id) {
      loadData();
    }
  }, [treatmentId, profile?.organization_id]);

  const loadData = async () => {
    try {
      const [treatmentRes, progressRes] = await Promise.all([
        supabase
          .from('risk_treatments')
          .select(`
            *,
            risk:risks(code, name),
            responsible_department:departments(name)
          `)
          .eq('id', treatmentId)
          .single(),
        supabase
          .from('risk_treatment_progress')
          .select(`
            *,
            updated_by:profiles(full_name)
          `)
          .eq('treatment_id', treatmentId)
          .order('created_at', { ascending: false })
      ]);

      if (treatmentRes.error) throw treatmentRes.error;
      if (progressRes.error) throw progressRes.error;

      setTreatment(treatmentRes.data);
      setProgressHistory(progressRes.data || []);

      if (treatmentRes.data) {
        setNewProgress({
          progress_percent: treatmentRes.data.progress_percent,
          status: treatmentRes.data.status,
          notes: ''
        });
      }
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error: progressError } = await supabase
        .from('risk_treatment_progress')
        .insert([{
          treatment_id: treatmentId,
          progress_percent: newProgress.progress_percent,
          status: newProgress.status,
          notes: newProgress.notes,
          updated_by_id: profile?.id
        }]);

      if (progressError) throw progressError;

      const { error: updateError } = await supabase
        .from('risk_treatments')
        .update({
          progress_percent: newProgress.progress_percent,
          status: newProgress.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', treatmentId);

      if (updateError) throw updateError;

      setNewProgress({ ...newProgress, notes: '' });
      loadData();
    } catch (error) {
      console.error('İlerleme kaydedilirken hata:', error);
      alert('İlerleme kaydedilemedi!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!treatment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Faaliyet bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => window.history.back()}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{treatment.title}</h1>
          <p className="text-slate-600 mt-1">Faaliyet Kodu: {treatment.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Faaliyet Bilgileri</h2>

          <div>
            <div className="text-sm text-slate-500">İlgili Risk</div>
            <div className="text-sm font-medium text-slate-900">
              {treatment.risk ? (
                `${treatment.risk.code} - ${treatment.risk.name}`
              ) : (
                <span className="text-red-600">Risk bilgisi eksik!</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Açıklama</div>
            <div className="text-sm text-slate-900">{treatment.description || '-'}</div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Faaliyet Türü</div>
            <div className="text-sm text-slate-900">{treatmentTypeLabels[treatment.treatment_type]}</div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Sorumlu Birim</div>
            <div className="text-sm text-slate-900">{treatment.responsible_department?.name || '-'}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500">Planlanan Başlangıç</div>
              <div className="text-sm text-slate-900">
                {treatment.planned_start_date ? new Date(treatment.planned_start_date).toLocaleDateString('tr-TR') : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Planlanan Bitiş</div>
              <div className="text-sm text-slate-900">
                {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
              </div>
            </div>
          </div>

          {treatment.estimated_budget && (
            <div>
              <div className="text-sm text-slate-500">Tahmini Bütçe</div>
              <div className="text-sm text-slate-900">
                {treatment.estimated_budget.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm text-slate-500 mb-2">Mevcut İlerleme</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${treatment.progress_percent}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 min-w-[45px]">
                {treatment.progress_percent}%
              </span>
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-500">Durum</div>
            <div className="text-sm font-medium text-slate-900">{statusLabels[treatment.status]}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">İlerleme Güncelle</h2>

          <form onSubmit={handleProgressUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                İlerleme Yüzdesi: {newProgress.progress_percent}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={newProgress.progress_percent}
                onChange={(e) => setNewProgress({ ...newProgress, progress_percent: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Durum
              </label>
              <select
                value={newProgress.status}
                onChange={(e) => setNewProgress({ ...newProgress, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Açıklama / Notlar
              </label>
              <textarea
                rows={4}
                value={newProgress.notes}
                onChange={(e) => setNewProgress({ ...newProgress, notes: e.target.value })}
                placeholder="İlerleme hakkında not ekleyin..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              İlerleme Kaydet
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">İlerleme Geçmişi</h2>

        {progressHistory.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            Henüz ilerleme kaydı bulunmuyor
          </div>
        ) : (
          <div className="space-y-4">
            {progressHistory.map((record) => (
              <div key={record.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-slate-900">
                        {record.progress_percent}%
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {statusLabels[record.status]}
                      </span>
                    </div>
                    {record.notes && (
                      <p className="text-sm text-slate-600 mt-2">{record.notes}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <div>{record.updated_by?.full_name}</div>
                    <div>{new Date(record.created_at).toLocaleString('tr-TR')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
