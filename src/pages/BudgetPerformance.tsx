import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { TrendingUp, TrendingDown, DollarSign, Calendar, LinkIcon, Target, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useBudgetPeriod } from '../hooks/useBudgetPeriod';

export default function BudgetPerformance() {
  const { profile } = useAuth();
  const { getCurrentFiscalYear } = useBudgetPeriod();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalExpense: 0,
    totalRevenue: 0,
    activePrograms: 0,
    activeCampaigns: 0,
    totalMappings: 0,
    mappingsWithIndicators: 0,
    mappedDepartments: 0,
  });

  useEffect(() => {
    if (profile) {
      loadStats();
    }
  }, [profile]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const fiscalYear = getCurrentFiscalYear();

      const { data: expenseData } = await supabase
        .from('expense_budget_entries')
        .select('amount_2025, amount_2026, amount_2027')
        .eq('organization_id', profile?.organization_id);

      const { data: revenueData } = await supabase
        .from('revenue_budget_entries')
        .select('amount_2025, amount_2026, amount_2027')
        .eq('organization_id', profile?.organization_id);

      const { data: programsData } = await supabase
        .from('programs')
        .select('id', { count: 'exact', head: true })
        .or(`organization_id.eq.${profile?.organization_id},organization_id.is.null`)
        .eq('is_active', true);

      const { data: campaignsData } = await supabase
        .from('budget_proposal_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id)
        .eq('status', 'active');

      const { data: mappingsData } = await supabase
        .from('program_activity_indicator_mappings')
        .select('id, department_id, indicator_id')
        .eq('organization_id', profile?.organization_id)
        .eq('fiscal_year', fiscalYear || new Date().getFullYear())
        .eq('is_active', true);

      const totalExpense = (expenseData || []).reduce((sum, entry) =>
        sum + (entry.amount_2025 || 0) + (entry.amount_2026 || 0) + (entry.amount_2027 || 0), 0
      );

      const totalRevenue = (revenueData || []).reduce((sum, entry) =>
        sum + (entry.amount_2025 || 0) + (entry.amount_2026 || 0) + (entry.amount_2027 || 0), 0
      );

      const totalMappings = mappingsData?.length || 0;
      const mappingsWithIndicators = mappingsData?.filter(m => m.indicator_id)?.length || 0;
      const uniqueDepartments = new Set(mappingsData?.map(m => m.department_id)).size;

      setStats({
        totalExpense,
        totalRevenue,
        activePrograms: programsData?.length || 0,
        activeCampaigns: campaignsData?.length || 0,
        totalMappings,
        mappingsWithIndicators,
        mappedDepartments: uniqueDepartments,
      });
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' ₺';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bütçe - Performans</h1>
        <p className="text-slate-600 mt-1">Program bazlı bütçe yönetimi ve performans takibi özeti</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Toplam Gider</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(stats.totalExpense)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Toplam Gelir</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Aktif Program</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {stats.activePrograms}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Aktif Kampanya</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {stats.activeCampaigns}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Program Eşleştirme İstatistikleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Toplam Eşleştirme</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.totalMappings}
                </p>
                <p className="text-xs text-slate-500 mt-1">Program-Faaliyet</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <LinkIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Gösterge Eşleştirme</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.mappingsWithIndicators}
                </p>
                <p className="text-xs text-slate-500 mt-1">Stratejik Plan ile</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Eşleştirilmiş Birim</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.mappedDepartments}
                </p>
                <p className="text-xs text-slate-500 mt-1">Müdürlük/Birim</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Not:</strong> Detaylı gider ve gelir kayıtları için sol menüden ilgili bölümlere erişebilirsiniz.
        </p>
      </div>
    </div>
  );
}
