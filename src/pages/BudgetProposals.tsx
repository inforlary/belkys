import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Plus, FileText, TrendingUp, Building2, Eye, ChevronRight } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface ActivitySummary {
  activity_id: string;
  activity_name: string;
  program_code: string;
  program_name: string;
  sub_program_code: string;
  sub_program_name: string;
  entry_count: number;
  total_2026: number;
  total_2027: number;
  total_2028: number;
  department_name: string;
}

export default function BudgetProposals() {
  const { user, profile } = useAuth();
  const { navigate } = useLocation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

  useEffect(() => {
    if (user && profile) {
      loadData();
    }
  }, [user, profile]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: campaignsData, error: campaignsError } = await supabase
        .from('budget_proposal_campaigns')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('fiscal_year', { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);

      const { data: entries, error: entriesError } = await supabase
        .from('expense_budget_entries')
        .select(`
          id,
          activity_id,
          created_at,
          department_id,
          activity:activities(
            id,
            name,
            department:departments(name),
            sub_program:sub_programs(
              full_code,
              name,
              program:programs(code, name)
            )
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('created_by', user.id);

      if (entriesError) throw entriesError;

      if (entries && entries.length > 0) {
        const entryIds = entries.map(e => e.id);

        const { data: proposals, error: proposalsError } = await supabase
          .from('expense_budget_proposals')
          .select('entry_id, year, amount')
          .in('entry_id', entryIds);

        if (proposalsError) throw proposalsError;

        const activityMap = new Map<string, ActivitySummary>();

        entries.forEach(entry => {
          const activity = entry.activity as any;
          if (!activity) return;

          const activityId = activity.id;

          if (!activityMap.has(activityId)) {
            activityMap.set(activityId, {
              activity_id: activityId,
              activity_name: activity.name || 'İsimsiz Faaliyet',
              program_code: activity.sub_program?.program?.code || '-',
              program_name: activity.sub_program?.program?.name || '-',
              sub_program_code: activity.sub_program?.full_code || '-',
              sub_program_name: activity.sub_program?.name || '-',
              department_name: activity.department?.name || '-',
              entry_count: 0,
              total_2026: 0,
              total_2027: 0,
              total_2028: 0
            });
          }

          const summary = activityMap.get(activityId)!;
          summary.entry_count++;

          const entryProposals = proposals?.filter(p => p.entry_id === entry.id) || [];
          entryProposals.forEach(p => {
            if (p.year === 2026) summary.total_2026 += Number(p.amount);
            if (p.year === 2027) summary.total_2027 += Number(p.amount);
            if (p.year === 2028) summary.total_2028 += Number(p.amount);
          });
        });

        setActivities(Array.from(activityMap.values()));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ₺';
  };

  const calculateGrandTotal = (year: 2026 | 2027 | 2028) => {
    return activities.reduce((sum, act) => {
      if (year === 2026) return sum + act.total_2026;
      if (year === 2027) return sum + act.total_2027;
      if (year === 2028) return sum + act.total_2028;
      return sum;
    }, 0);
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Program Yapısı ve Faaliyetlerim</h1>
            <p className="mt-1 text-blue-100">
              Bütçe teklifiniz için program yapınızı ve faaliyetlerinizi tanımlayın
            </p>
          </div>
        </div>
      </div>

      {activeCampaigns.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Bütçe Kampanyası</h3>
              <div className="space-y-2">
                {activeCampaigns.map(campaign => (
                  <div key={campaign.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{campaign.name}</div>
                      <div className="text-sm text-gray-600">
                        Mali Yıl: {campaign.fiscal_year} |
                        {' '}{new Date(campaign.start_date).toLocaleDateString('tr-TR')} -
                        {' '}{new Date(campaign.end_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/budget-program-structure?campaign=${campaign.id}`)}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Faaliyet Ekle / Gider Gir</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz faaliyet eklenmemiş</h3>
          <p className="text-gray-500 mb-6">
            Bütçe teklifinizi hazırlamak için program yapısında faaliyetler ekleyin ve gider kalemleri girin
          </p>
          {activeCampaigns.length > 0 && (
            <button
              onClick={() => navigate(`/budget-program-structure?campaign=${activeCampaigns[0].id}`)}
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Program Yapısına Git</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Faaliyetleriniz ve Bütçe Özeti</h2>
              <p className="text-sm text-gray-600 mt-1">
                {activities.length} faaliyet için toplam{' '}
                {activities.reduce((sum, a) => sum + a.entry_count, 0)} gider kalemi girildi
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Program / Alt Program / Faaliyet
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Gider Kalemi Sayısı
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      2026 Tutarı
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      2027 Tutarı
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      2028 Tutarı
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activities.map((activity) => (
                    <tr key={activity.activity_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">{activity.department_name}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">{activity.program_code}</span> - {activity.program_name}
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">{activity.sub_program_code}</span> - {activity.sub_program_name}
                          </div>
                          <div className="font-medium text-sm text-gray-900 mt-1">
                            {activity.activity_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                          {activity.entry_count}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(activity.total_2026)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(activity.total_2027)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(activity.total_2028)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => navigate(`/budget-expense-items?activity=${activity.activity_id}`)}
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
                          title="Detayları Görüntüle"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Detay</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gradient-to-r from-blue-50 to-blue-100 border-t-2 border-blue-300">
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-right font-bold text-gray-900 text-sm uppercase">
                      Genel Toplam:
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-base font-bold text-blue-700">
                        {formatCurrency(calculateGrandTotal(2026))}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-base font-bold text-blue-700">
                        {formatCurrency(calculateGrandTotal(2027))}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-base font-bold text-blue-700">
                        {formatCurrency(calculateGrandTotal(2028))}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {activeCampaigns.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-900">Yeni Faaliyet Ekle</div>
                  <div className="text-sm text-blue-700">
                    Başka faaliyetler eklemek veya mevcut faaliyetlere gider kalemi girmek için
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/budget-program-structure?campaign=${activeCampaigns[0].id}`)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Program Yapısına Git</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
