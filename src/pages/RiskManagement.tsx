import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertTriangle, TrendingUp, TrendingDown, Shield, BarChart3, AlertCircle } from 'lucide-react';

export default function RiskManagement() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalRisks: 0,
    criticalRisks: 0,
    highRisks: 0,
    mediumRisks: 0,
    lowRisks: 0,
    activeControls: 0,
    activeTreatments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadStats();
    }
  }, [profile?.organization_id]);

  const loadStats = async () => {
    try {
      const { data: risks, error: risksError } = await supabase
        .from('risks')
        .select('id, risk_level, residual_score')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true);

      if (risksError) throw risksError;

      const { data: controls, error: controlsError } = await supabase
        .from('risk_controls')
        .select('id')
        .eq('is_active', true);

      if (controlsError) throw controlsError;

      const { data: treatments, error: treatmentsError } = await supabase
        .from('risk_treatments')
        .select('id')
        .in('status', ['PLANNED', 'IN_PROGRESS']);

      if (treatmentsError) throw treatmentsError;

      const criticalRisks = risks?.filter(r => (r.residual_score || 0) >= 20).length || 0;
      const highRisks = risks?.filter(r => (r.residual_score || 0) >= 15 && (r.residual_score || 0) < 20).length || 0;
      const mediumRisks = risks?.filter(r => (r.residual_score || 0) >= 9 && (r.residual_score || 0) < 15).length || 0;
      const lowRisks = risks?.filter(r => (r.residual_score || 0) < 9).length || 0;

      setStats({
        totalRisks: risks?.length || 0,
        criticalRisks,
        highRisks,
        mediumRisks,
        lowRisks,
        activeControls: controls?.length || 0,
        activeTreatments: treatments?.length || 0,
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
          <AlertTriangle className="w-8 h-8 text-orange-600" />
          Risk Yönetimi Dashboard
        </h1>
        <p className="text-slate-600 mt-2">
          Kurumsal risk yönetimi süreçlerinizi izleyin ve yönetin
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Toplam Risk</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalRisks}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Kritik Riskler</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.criticalRisks}</p>
              <p className="text-xs text-slate-500 mt-1">Skor: 20-25</p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Yüksek Riskler</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.highRisks}</p>
              <p className="text-xs text-slate-500 mt-1">Skor: 15-19</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Orta/Düşük Riskler</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.mediumRisks + stats.lowRisks}</p>
              <p className="text-xs text-slate-500 mt-1">Skor: 1-14</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Aktif Kontroller</h3>
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.activeControls}</p>
          <p className="text-sm text-slate-600 mt-2">Risklere karşı uygulanan kontrol sayısı</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Devam Eden Faaliyetler</h3>
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-600">{stats.activeTreatments}</p>
          <p className="text-sm text-slate-600 mt-2">Risk azaltma faaliyetleri</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-orange-100 rounded-full p-2 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Risk Yönetimi Hakkında</h3>
            <p className="text-slate-700 mb-4">
              Risk yönetimi modülü ile kurumunuzun karşılaşabileceği riskleri belirleyebilir,
              değerlendirebilir ve bu risklere karşı kontrol ve tedbirler oluşturabilirsiniz.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">•</span>
                <span>Risk Kaydı: Tüm riskleri detaylı şekilde kaydedin ve 5x5 matris ile değerlendirin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">•</span>
                <span>Risk Matrisi: Riskleri görsel olarak analiz edin ve önceliklendirin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">•</span>
                <span>Göstergeler: KRI ve LEI göstergeleri ile riskleri proaktif olarak izleyin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">•</span>
                <span>Faaliyetler: Risk azaltma faaliyetlerini planlayın ve takip edin</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
