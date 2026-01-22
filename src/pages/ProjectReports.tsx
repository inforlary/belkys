import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, BarChart3, TrendingUp, CheckCircle } from 'lucide-react';

export default function ProjectReports() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    total_projects: 0,
    completed: 0,
    in_progress: 0,
    planned: 0,
    delayed: 0,
    avg_physical_progress: 0,
    avg_financial_progress: 0,
    total_budget: 0,
    total_expense: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadStats();
    }
  }, [profile?.organization_id]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data: projects, error } = await supabase
        .from('projects')
        .select('status, physical_progress, financial_progress, contract_amount, total_expense')
        .eq('organization_id', profile?.organization_id);

      if (error) throw error;

      const stats = {
        total_projects: projects?.length || 0,
        completed: projects?.filter(p => p.status === 'completed').length || 0,
        in_progress: projects?.filter(p => p.status === 'in_progress').length || 0,
        planned: projects?.filter(p => p.status === 'planned').length || 0,
        delayed: projects?.filter(p => p.status === 'delayed').length || 0,
        avg_physical_progress: projects?.length > 0
          ? Math.round(projects.reduce((sum, p) => sum + (p.physical_progress || 0), 0) / projects.length)
          : 0,
        avg_financial_progress: projects?.length > 0
          ? Math.round(projects.reduce((sum, p) => sum + (p.financial_progress || 0), 0) / projects.length)
          : 0,
        total_budget: projects?.reduce((sum, p) => sum + (p.contract_amount || 0), 0) || 0,
        total_expense: projects?.reduce((sum, p) => sum + (p.total_expense || 0), 0) || 0
      };

      setStats(stats);
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
    } finally {
      setLoading(false);
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Proje Yönetimi Raporları</h1>
        <p className="text-blue-100 mt-2">Proje performans analizleri ve istatistikler</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Toplam Proje</span>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.total_projects}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Tamamlanan</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-xs text-gray-500 mt-1">
            %{stats.total_projects > 0 ? Math.round((stats.completed / stats.total_projects) * 100) : 0}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Devam Eden</span>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-600">{stats.in_progress}</div>
          <div className="text-xs text-gray-500 mt-1">
            %{stats.total_projects > 0 ? Math.round((stats.in_progress / stats.total_projects) * 100) : 0}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Gecikmiş</span>
            <BarChart3 className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">{stats.delayed}</div>
          <div className="text-xs text-gray-500 mt-1">
            %{stats.total_projects > 0 ? Math.round((stats.delayed / stats.total_projects) * 100) : 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">İlerleme Durumu</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Ortalama Fiziki İlerleme</span>
                <span className="text-lg font-bold text-blue-600">%{stats.avg_physical_progress}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.avg_physical_progress}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Ortalama Nakdi İlerleme</span>
                <span className="text-lg font-bold text-green-600">%{stats.avg_financial_progress}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.avg_financial_progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bütçe Durumu</h3>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-600">Toplam Sözleşme Tutarı</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {(stats.total_budget / 1000000).toFixed(2)} M ₺
              </div>
            </div>

            <div>
              <span className="text-sm text-gray-600">Toplam Harcama</span>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {(stats.total_expense / 1000000).toFixed(2)} M ₺
              </div>
            </div>

            <div>
              <span className="text-sm text-gray-600">Gerçekleşme Oranı</span>
              <div className="text-2xl font-bold text-green-600 mt-1">
                %{stats.total_budget > 0 ? ((stats.total_expense / stats.total_budget) * 100).toFixed(1) : 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Durum Dağılımı</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600 mt-1">Tamamlandı</div>
          </div>

          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-3xl font-bold text-orange-600">{stats.in_progress}</div>
            <div className="text-sm text-gray-600 mt-1">Devam Ediyor</div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-3xl font-bold text-gray-600">{stats.planned}</div>
            <div className="text-sm text-gray-600 mt-1">Planlandı</div>
          </div>

          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-3xl font-bold text-red-600">{stats.delayed}</div>
            <div className="text-sm text-gray-600 mt-1">Gecikmiş</div>
          </div>
        </div>
      </div>
    </div>
  );
}
