import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { User, Building2, Target, CheckCircle, Clock, AlertCircle, TrendingUp, Award, BarChart3, Activity } from 'lucide-react';
import type { Profile, Department } from '../types/database';

interface VPWithDepartments {
  id: string;
  full_name: string;
  email: string;
  departments: Department[];
}

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  active_indicators: number;
  data_entries: number;
  pending_approvals: number;
  approved_entries: number;
  rejected_entries: number;
  completion_rate: number;
}

interface VPOverallPerformance {
  total_departments: number;
  total_indicators: number;
  total_data_entries: number;
  total_approved: number;
  total_pending: number;
  total_rejected: number;
  overall_completion_rate: number;
  performance_grade: string;
  performance_color: string;
}

export default function VicePresidentPerformance() {
  const { profile } = useAuth();
  const [vicePresidents, setVicePresidents] = useState<VPWithDepartments[]>([]);
  const [selectedVP, setSelectedVP] = useState<string | null>(null);
  const [performance, setPerformance] = useState<DepartmentPerformance[]>([]);
  const [overallPerformance, setOverallPerformance] = useState<VPOverallPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);

  useEffect(() => {
    loadVicePresidents();
  }, []);

  useEffect(() => {
    if (selectedVP) {
      loadPerformance();
    }
  }, [selectedVP, selectedYear]);

  async function loadVicePresidents() {
    setLoading(true);
    try {
      const { data: vps, error: vpsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'vice_president')
        .eq('organization_id', profile?.organization_id)
        .order('full_name');

      if (vpsError) throw vpsError;

      if (vps && vps.length > 0) {
        const vpsWithDepts: VPWithDepartments[] = [];

        for (const vp of vps) {
          const { data: vpDepts, error: vpDeptsError } = await supabase
            .from('vice_president_departments')
            .select('department_id')
            .eq('vice_president_id', vp.id);

          if (vpDeptsError) {
            console.error('Error loading departments for VP:', vp.id, vpDeptsError);
            vpsWithDepts.push({
              id: vp.id,
              full_name: vp.full_name,
              email: vp.email,
              departments: [],
            });
            continue;
          }

          const departmentIds = vpDepts?.map(d => d.department_id) || [];

          if (departmentIds.length === 0) {
            vpsWithDepts.push({
              id: vp.id,
              full_name: vp.full_name,
              email: vp.email,
              departments: [],
            });
            continue;
          }

          const { data: departments, error: deptsError } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', departmentIds)
            .order('name');

          if (deptsError) {
            console.error('Error loading department details:', deptsError);
          }

          console.log('VP', vp.full_name, 'has', departments?.length || 0, 'departments:', departments);

          vpsWithDepts.push({
            id: vp.id,
            full_name: vp.full_name,
            email: vp.email,
            departments: departments || [],
          });
        }

        setVicePresidents(vpsWithDepts);
        if (vpsWithDepts.length > 0) {
          setSelectedVP(vpsWithDepts[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading vice presidents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformance() {
    if (!selectedVP) return;

    try {
      const vp = vicePresidents.find(v => v.id === selectedVP);
      if (!vp || vp.departments.length === 0) {
        setPerformance([]);
        setOverallPerformance(null);
        return;
      }

      const departmentIds = vp.departments.map(d => d.id);
      const performanceData: DepartmentPerformance[] = [];

      let totalIndicators = 0;
      let totalDataEntries = 0;
      let totalApproved = 0;
      let totalPending = 0;
      let totalRejected = 0;

      for (const dept of vp.departments) {
        console.log('Loading performance for department:', dept.name, dept.id);

        const { data: goals, error: goalsError } = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile?.organization_id)
          .eq('department_id', dept.id);

        if (goalsError) {
          console.error('Error loading goals for dept:', dept.id, goalsError);
          throw goalsError;
        }

        console.log('Goals for', dept.name, ':', goals);

        const goalIds = goals?.map(g => g.id) || [];

        if (goalIds.length === 0) {
          performanceData.push({
            department_id: dept.id,
            department_name: dept.name,
            total_indicators: 0,
            active_indicators: 0,
            data_entries: 0,
            pending_approvals: 0,
            approved_entries: 0,
            rejected_entries: 0,
            completion_rate: 0,
          });
          continue;
        }

        const { data: indicators, error: indicatorsError } = await supabase
          .from('indicators')
          .select('id')
          .in('goal_id', goalIds);

        if (indicatorsError) {
          console.error('Error loading indicators for goals:', goalIds, indicatorsError);
          throw indicatorsError;
        }

        console.log('Indicators for', dept.name, ':', indicators);

        const indicatorIds = indicators?.map(i => i.id) || [];
        const deptTotalIndicators = indicatorIds.length;
        totalIndicators += deptTotalIndicators;

        if (indicatorIds.length === 0) {
          performanceData.push({
            department_id: dept.id,
            department_name: dept.name,
            total_indicators: 0,
            active_indicators: 0,
            data_entries: 0,
            pending_approvals: 0,
            approved_entries: 0,
            rejected_entries: 0,
            completion_rate: 0,
          });
          continue;
        }

        const { data: entries, error: entriesError } = await supabase
          .from('indicator_data_entries')
          .select('id, status, period_quarter, period_year')
          .in('indicator_id', indicatorIds)
          .eq('period_year', selectedYear);

        if (entriesError) {
          console.error('Error loading entries for indicators:', indicatorIds, entriesError);
          throw entriesError;
        }

        console.log('Entries for', dept.name, ':', entries);

        const totalEntries = entries?.length || 0;
        const pendingApprovals = entries?.filter(e => e.status === 'pending' || e.status === 'submitted_to_director' || e.status === 'submitted_to_admin').length || 0;
        const approvedEntries = entries?.filter(e => e.status === 'approved' || e.status === 'admin_approved').length || 0;
        const rejectedEntries = entries?.filter(e => e.status === 'rejected').length || 0;

        totalDataEntries += totalEntries;
        totalApproved += approvedEntries;
        totalPending += pendingApprovals;
        totalRejected += rejectedEntries;

        const expectedEntries = deptTotalIndicators * 4;
        const completionRate = expectedEntries > 0 ? (approvedEntries / expectedEntries) * 100 : 0;

        performanceData.push({
          department_id: dept.id,
          department_name: dept.name,
          total_indicators: deptTotalIndicators,
          active_indicators: deptTotalIndicators,
          data_entries: totalEntries,
          pending_approvals: pendingApprovals,
          approved_entries: approvedEntries,
          rejected_entries: rejectedEntries,
          completion_rate: completionRate,
        });
      }

      const expectedTotalEntries = totalIndicators * 4;
      const overallCompletionRate = expectedTotalEntries > 0 ? (totalApproved / expectedTotalEntries) * 100 : 0;

      let grade = '';
      let color = '';
      if (overallCompletionRate >= 90) {
        grade = 'Mükemmel';
        color = 'emerald';
      } else if (overallCompletionRate >= 80) {
        grade = 'Çok İyi';
        color = 'green';
      } else if (overallCompletionRate >= 70) {
        grade = 'İyi';
        color = 'blue';
      } else if (overallCompletionRate >= 60) {
        grade = 'Orta';
        color = 'yellow';
      } else if (overallCompletionRate >= 50) {
        grade = 'Zayıf';
        color = 'orange';
      } else {
        grade = 'Yetersiz';
        color = 'red';
      }

      setOverallPerformance({
        total_departments: vp.departments.length,
        total_indicators: totalIndicators,
        total_data_entries: totalDataEntries,
        total_approved: totalApproved,
        total_pending: totalPending,
        total_rejected: totalRejected,
        overall_completion_rate: overallCompletionRate,
        performance_grade: grade,
        performance_color: color,
      });

      setPerformance(performanceData.sort((a, b) => b.completion_rate - a.completion_rate));
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  }

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-50';
    if (rate >= 60) return 'text-blue-600 bg-blue-50';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getGradeColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-500',
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
    };
    return colors[color] || 'bg-gray-500';
  };

  const getGradeBgColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-50 border-emerald-200',
      green: 'bg-green-50 border-green-200',
      blue: 'bg-blue-50 border-blue-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      orange: 'bg-orange-50 border-orange-200',
      red: 'bg-red-50 border-red-200',
    };
    return colors[color] || 'bg-gray-50 border-gray-200';
  };

  const getGradeTextColor = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'text-emerald-700',
      green: 'text-green-700',
      blue: 'text-blue-700',
      yellow: 'text-yellow-700',
      orange: 'text-orange-700',
      red: 'text-red-700',
    };
    return colors[color] || 'text-gray-700';
  };

  const selectedVPData = vicePresidents.find(v => v.id === selectedVP);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (vicePresidents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Başkan Yardımcıları Performans Değerlendirmesi</h1>
          <p className="mt-2 text-slate-600">Başkan yardımcılarının genel performansını ve sorumlu oldukları müdürlüklerin detaylı analizini görüntüleyin</p>
        </div>
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Henüz başkan yardımcısı tanımlanmamış</p>
              <p className="text-sm text-slate-400">Başkan yardımcısı eklemek için Kullanıcılar sayfasından yeni kullanıcı oluşturun ve rolünü "Başkan Yardımcısı" olarak belirleyin.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Başkan Yardımcıları Performans Değerlendirmesi</h1>
        <p className="mt-2 text-slate-600">Başkan yardımcılarının genel performansını ve sorumlu oldukları müdürlüklerin detaylı analizini görüntüleyin</p>
      </div>

      <div className="flex gap-4 items-center bg-white rounded-lg p-4 border border-slate-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-2">Yıl</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[2024, 2025, 2026, 2027, 2028].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {vicePresidents.map((vp) => (
          <button
            key={vp.id}
            onClick={() => setSelectedVP(vp.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selectedVP === vp.id
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{vp.full_name}</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{vp.email}</p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-orange-600">
                  <Building2 className="w-3 h-3" />
                  <span>{vp.departments.length} Müdürlük</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedVP && selectedVPData && (
        <div className="space-y-6">
          {overallPerformance && (
            <div className={`border-2 rounded-2xl overflow-hidden ${getGradeBgColor(overallPerformance.performance_color)}`}>
              <div className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">{selectedVPData.full_name}</h2>
                        <p className="text-slate-600">{selectedVPData.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl ${getGradeColor(overallPerformance.performance_color)} text-white shadow-lg`}>
                      <Award className="w-6 h-6" />
                      <div>
                        <div className="text-2xl font-bold">{overallPerformance.performance_grade}</div>
                        <div className="text-xs opacity-90">Genel Performans</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="text-xs font-medium">Müdürlük</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{overallPerformance.total_departments}</div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-medium">Gösterge</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{overallPerformance.total_indicators}</div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs font-medium">Toplam Veri</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{overallPerformance.total_data_entries}</div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Onaylı</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">{overallPerformance.total_approved}</div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-700 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium">Bekleyen</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-900">{overallPerformance.total_pending}</div>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200">
                    <div className="flex items-center gap-2 text-red-700 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Red</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900">{overallPerformance.total_rejected}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-5 h-5 ${getGradeTextColor(overallPerformance.performance_color)}`} />
                      <span className={`font-bold ${getGradeTextColor(overallPerformance.performance_color)}`}>
                        Genel Tamamlanma Oranı
                      </span>
                    </div>
                    <span className={`text-2xl font-bold ${getGradeTextColor(overallPerformance.performance_color)}`}>
                      %{overallPerformance.overall_completion_rate.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-white rounded-full h-4 shadow-inner border border-slate-200">
                    <div
                      className={`h-4 rounded-full transition-all ${getGradeColor(overallPerformance.performance_color)}`}
                      style={{ width: `${Math.min(overallPerformance.overall_completion_rate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">Müdürlük Bazlı Performans Detayları</h2>
              </div>
              <p className="text-sm text-slate-500 mt-1">Sorumlu müdürlüklerin performans sıralaması (en yüksekten en düşüğe)</p>
            </CardHeader>
            <CardBody>
              {selectedVPData.departments.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Bu başkan yardımcısına henüz müdürlük atanmamış</p>
                </div>
              ) : performance.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Henüz performans verisi yok</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {performance.map((dept, index) => (
                    <div key={dept.department_id} className="border-2 border-slate-200 rounded-xl p-6 bg-white hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold">
                            #{index + 1}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
                              <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-lg">{dept.department_name}</h3>
                              <p className="text-sm text-slate-500">{dept.total_indicators} Gösterge</p>
                            </div>
                          </div>
                        </div>
                        <div className={`px-5 py-3 rounded-xl font-bold text-lg shadow-md ${getCompletionColor(dept.completion_rate)}`}>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            <span>%{dept.completion_rate.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Target className="w-4 h-4" />
                            <span className="text-xs font-medium">Toplam Veri</span>
                          </div>
                          <div className="text-xl font-bold text-blue-900">{dept.data_entries}</div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <div className="flex items-center gap-2 text-green-600 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Onaylı</span>
                          </div>
                          <div className="text-xl font-bold text-green-900">{dept.approved_entries}</div>
                        </div>

                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <div className="flex items-center gap-2 text-yellow-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-medium">Bekleyen</span>
                          </div>
                          <div className="text-xl font-bold text-yellow-900">{dept.pending_approvals}</div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-center gap-2 text-red-600 mb-1">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Red</span>
                          </div>
                          <div className="text-xl font-bold text-red-900">{dept.rejected_entries}</div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
                          <span>İlerleme Durumu</span>
                          <span>{dept.approved_entries} / {dept.total_indicators * 4}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 shadow-inner">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              dept.completion_rate >= 80 ? 'bg-green-600' :
                              dept.completion_rate >= 60 ? 'bg-blue-600' :
                              dept.completion_rate >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(dept.completion_rate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
