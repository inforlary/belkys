import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  AlertTriangle, Shield, TrendingUp, Activity,
  FileText, BarChart3, Target, AlertCircle
} from 'lucide-react';

interface RiskStats {
  total: number;
  critical: number;
  veryHigh: number;
  high: number;
  medium: number;
  low: number;
  byCategory: { category: string; count: number; color: string }[];
  criticalRisks: any[];
  treatments: {
    completed: number;
    inProgress: number;
    delayed: number;
    planned: number;
  };
}

export default function RiskDashboard() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [stats, setStats] = useState<RiskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadStats();
    }
  }, [profile]);

  const loadStats = async () => {
    try {
      const { data: risks, error } = await supabase
        .from('risks')
        .select(`
          *,
          category:risk_categories(name, color),
          owner_unit:departments(name)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      if (error) throw error;

      const { data: treatments } = await supabase
        .from('risk_treatments')
        .select('status')
        .in('risk_id', risks?.map(r => r.id) || []);

      const levelCounts = {
        critical: risks?.filter(r => r.residual_level === 'critical').length || 0,
        very_high: risks?.filter(r => r.residual_level === 'very_high').length || 0,
        high: risks?.filter(r => r.residual_level === 'high').length || 0,
        medium: risks?.filter(r => r.residual_level === 'medium').length || 0,
        low: risks?.filter(r => r.residual_level === 'low').length || 0,
      };

      const categoryStats = risks?.reduce((acc: any, risk) => {
        const catName = risk.category?.name || 'Diğer';
        const existing = acc.find((c: any) => c.category === catName);
        if (existing) {
          existing.count++;
        } else {
          acc.push({
            category: catName,
            count: 1,
            color: risk.category?.color || '#6B7280'
          });
        }
        return acc;
      }, []) || [];

      setStats({
        total: risks?.length || 0,
        critical: levelCounts.critical,
        veryHigh: levelCounts.very_high,
        high: levelCounts.high,
        medium: levelCounts.medium,
        low: levelCounts.low,
        byCategory: categoryStats,
        criticalRisks: risks?.filter(r =>
          r.residual_level === 'critical' || r.residual_level === 'very_high'
        ).slice(0, 5) || [],
        treatments: {
          completed: treatments?.filter(t => t.status === 'completed').length || 0,
          inProgress: treatments?.filter(t => t.status === 'in_progress').length || 0,
          delayed: treatments?.filter(t => t.status === 'delayed').length || 0,
          planned: treatments?.filter(t => t.status === 'planned').length || 0,
        }
      });
    } catch (error) {
      console.error('Error loading risk stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-900 text-white';
      case 'very_high': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getRiskLevelLabel = (level: string) => {
    switch (level) {
      case 'critical': return 'Kritik';
      case 'very_high': return 'Çok Yüksek';
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
      default: return level;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Yönetimi</h1>
          <p className="text-gray-600">Kurumsal risk yönetimi ve değerlendirme</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('risks/register/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Yeni Risk Tanımla
          </button>
          <button
            onClick={() => navigate('risks/reports')}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Raporlar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Risk</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.total}</p>
            </div>
            <Shield className="w-12 h-12 text-gray-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-100">Kritik / Çok Yüksek</p>
              <p className="text-3xl font-bold mt-1">{(stats?.critical || 0) + (stats?.veryHigh || 0)}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-100">Yüksek</p>
              <p className="text-3xl font-bold mt-1">{stats?.high}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-100">Orta</p>
              <p className="text-3xl font-bold mt-1">{stats?.medium}</p>
            </div>
            <Activity className="w-12 h-12 text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100">Düşük</p>
              <p className="text-3xl font-bold mt-1">{stats?.low}</p>
            </div>
            <Shield className="w-12 h-12 text-green-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Risk Matrisi Özeti</h2>
              <button
                onClick={() => navigate('risks/matrix')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Detaylı Matris →
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">5x5 İnteraktif Risk Matrisi</p>
              <button
                onClick={() => navigate('risks/matrix')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Target className="w-4 h-4" />
                Matrisi Görüntüle
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kategori Bazlı Dağılım</h2>
            {stats?.byCategory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Henüz risk bulunmuyor</p>
            ) : (
              <div className="space-y-3">
                {stats?.byCategory.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                        <span className="text-sm text-gray-600">{cat.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(cat.count / (stats?.total || 1)) * 100}%`,
                            backgroundColor: cat.color
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">İlave Faaliyet Durumu</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <div>
                  <p className="text-sm text-gray-600">Tamamlanan</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.treatments.completed}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <div>
                  <p className="text-sm text-gray-600">Devam Eden</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.treatments.inProgress}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div>
                  <p className="text-sm text-gray-600">Geciken</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.treatments.delayed}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-400 rounded-full" />
                <div>
                  <p className="text-sm text-gray-600">Planlanan</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.treatments.planned}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('risks/treatments')}
              className="mt-4 block w-full text-center text-sm text-blue-600 hover:text-blue-700"
            >
              Tüm Faaliyetleri Görüntüle →
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kritik Riskler</h2>
            <div className="space-y-3">
              {stats?.criticalRisks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Kritik risk bulunmuyor</p>
              ) : (
                stats?.criticalRisks.map((risk) => (
                  <button
                    key={risk.id}
                    onClick={() => navigate(`risks/register/${risk.id}`)}
                    className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                        risk.residual_level === 'critical' ? 'text-red-900' : 'text-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {risk.code} - {risk.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Skor: {risk.residual_score} | {risk.owner_unit?.name}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${getRiskLevelColor(risk.residual_level)}`}>
                          {getRiskLevelLabel(risk.residual_level)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => navigate('risks/register')}
              className="mt-4 block w-full text-center text-sm text-blue-600 hover:text-blue-700"
            >
              Tüm Riskleri Görüntüle →
            </button>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Hızlı Erişim</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('risks/register')}
                className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 w-full text-left"
              >
                <FileText className="w-4 h-4" />
                Risk Kaydı
              </button>
              <button
                onClick={() => navigate('risks/matrix')}
                className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 w-full text-left"
              >
                <Target className="w-4 h-4" />
                Risk Matrisi
              </button>
              <button
                onClick={() => navigate('risks/indicators')}
                className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 w-full text-left"
              >
                <Activity className="w-4 h-4" />
                Risk Göstergeleri
              </button>
              <button
                onClick={() => navigate('risks/reports-summary')}
                className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 w-full text-left"
              >
                <BarChart3 className="w-4 h-4" />
                Raporlar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
