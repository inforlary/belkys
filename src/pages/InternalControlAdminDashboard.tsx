import { useState, useEffect } from 'react';
import { Shield, Users, TrendingUp, AlertCircle, CheckCircle, Clock, Award, Target, FileText, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface Period {
  id: string;
  year: number;
  title: string;
  status: string;
  assessment_deadline: string;
  is_current: boolean;
}

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  overall_completion_pct: number;
  overall_status: string;
  quality_score: number;
  timeliness_score: number;
  approved_assessments: number;
  rejected_assessments: number;
  total_risks: number;
  total_controls: number;
  total_capas: number;
  is_late: boolean;
  avg_compliance_level: number;
}

interface KIKSComplianceByComponent {
  component: string;
  avg_compliance_level: number;
  compliance_percentage: number;
  total_assessments: number;
  approved_assessments: number;
}

interface AdminStats {
  totalDepartments: number;
  departmentsCompleted: number;
  departmentsInProgress: number;
  departmentsPendingReview: number;
  totalAssessments: number;
  approvedAssessments: number;
  pendingReviewAssessments: number;
  avgComplianceLevel: number;
  avgOverallCompletion: number;
}

export default function InternalControlAdminDashboard() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [departmentPerformance, setDepartmentPerformance] = useState<DepartmentPerformance[]>([]);
  const [kiksCompliance, setKiksCompliance] = useState<KIKSComplianceByComponent[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalDepartments: 0,
    departmentsCompleted: 0,
    departmentsInProgress: 0,
    departmentsPendingReview: 0,
    totalAssessments: 0,
    approvedAssessments: 0,
    pendingReviewAssessments: 0,
    avgComplianceLevel: 0,
    avgOverallCompletion: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedPlanId) {
      loadPeriods();
    }
  }, [profile?.organization_id, selectedPlanId]);

  useEffect(() => {
    if (selectedPeriod) {
      loadDashboardData();
    }
  }, [selectedPeriod]);

  const loadPeriods = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_periods')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('year', { ascending: false });

      if (error) throw error;

      setPeriods(data || []);

      const currentPeriod = data?.find(p => p.is_current);
      if (currentPeriod) {
        setSelectedPeriod(currentPeriod.id);
      } else if (data && data.length > 0) {
        setSelectedPeriod(data[0].id);
      }
    } catch (error) {
      console.error('Dönemler yüklenirken hata:', error);
    }
  };

  const loadDashboardData = async () => {
    if (!profile?.organization_id || !selectedPeriod) return;

    try {
      setLoading(true);
      await Promise.all([
        loadDepartmentPerformance(),
        loadKIKSCompliance(),
        loadStats()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentPerformance = async () => {
    if (!selectedPeriod) return;

    try {
      const { data, error } = await supabase
        .from('ic_department_performance_summary')
        .select('*')
        .eq('period_id', selectedPeriod)
        .order('overall_completion_pct', { ascending: false });

      if (error) throw error;
      setDepartmentPerformance(data || []);
    } catch (error) {
      console.error('Müdürlük performansı yüklenirken hata:', error);
    }
  };

  const loadKIKSCompliance = async () => {
    if (!selectedPeriod) return;

    try {
      const { data, error } = await supabase
        .from('ic_kiks_compliance_scores')
        .select('*')
        .eq('period_id', selectedPeriod);

      if (error) throw error;

      const byComponent = (data || []).reduce((acc: any, curr: any) => {
        const existing = acc.find((c: any) => c.component === curr.component);
        if (existing) {
          existing.total_assessments += curr.total_assessments || 0;
          existing.approved_assessments += curr.approved_assessments || 0;
          existing.compliance_sum += (curr.avg_compliance_level || 0) * (curr.approved_assessments || 0);
          existing.compliance_pct_sum += curr.compliance_percentage || 0;
          existing.count += 1;
        } else {
          acc.push({
            component: curr.component,
            total_assessments: curr.total_assessments || 0,
            approved_assessments: curr.approved_assessments || 0,
            compliance_sum: (curr.avg_compliance_level || 0) * (curr.approved_assessments || 0),
            compliance_pct_sum: curr.compliance_percentage || 0,
            count: 1
          });
        }
        return acc;
      }, []);

      const result = byComponent.map((c: any) => ({
        component: c.component,
        avg_compliance_level: c.approved_assessments > 0 ? c.compliance_sum / c.approved_assessments : 0,
        compliance_percentage: c.count > 0 ? c.compliance_pct_sum / c.count : 0,
        total_assessments: c.total_assessments,
        approved_assessments: c.approved_assessments
      }));

      setKiksCompliance(result);
    } catch (error) {
      console.error('KİKS uyumluluk verileri yüklenirken hata:', error);
    }
  };

  const loadStats = async () => {
    if (!selectedPeriod) return;

    try {
      const { data: deptData, error: deptError } = await supabase
        .from('ic_department_completion_status')
        .select('*')
        .eq('period_id', selectedPeriod);

      if (deptError) throw deptError;

      const { data: assessmentData, error: assessError } = await supabase
        .from('ic_self_assessments')
        .select('compliance_level, status')
        .eq('period_id', selectedPeriod);

      if (assessError) throw assessError;

      const totalDepts = deptData?.length || 0;
      const completed = deptData?.filter(d => d.overall_status === 'completed').length || 0;
      const inProgress = deptData?.filter(d => d.overall_status === 'in_progress').length || 0;
      const pendingReview = deptData?.filter(d => d.overall_status === 'pending_review').length || 0;

      const totalAssessments = assessmentData?.length || 0;
      const approved = assessmentData?.filter(a => a.status === 'approved').length || 0;
      const underReview = assessmentData?.filter(a => a.status === 'under_review').length || 0;

      const approvedCompliance = assessmentData?.filter(a => a.status === 'approved') || [];
      const avgCompliance = approvedCompliance.length > 0
        ? approvedCompliance.reduce((sum, a) => sum + (a.compliance_level || 0), 0) / approvedCompliance.length
        : 0;

      const avgCompletion = deptData && deptData.length > 0
        ? deptData.reduce((sum, d) => sum + (d.overall_completion_pct || 0), 0) / deptData.length
        : 0;

      setStats({
        totalDepartments: totalDepts,
        departmentsCompleted: completed,
        departmentsInProgress: inProgress,
        departmentsPendingReview: pendingReview,
        totalAssessments,
        approvedAssessments: approved,
        pendingReviewAssessments: underReview,
        avgComplianceLevel: avgCompliance,
        avgOverallCompletion: avgCompletion
      });
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending_review':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'late':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      not_started: 'Başlanmadı',
      in_progress: 'Devam Ediyor',
      pending_review: 'İnceleme Bekliyor',
      completed: 'Tamamlandı',
      late: 'Gecikmede'
    };
    return statusMap[status] || status;
  };

  const getComplianceColor = (level: number) => {
    if (level >= 4) return 'text-green-600';
    if (level >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const componentNames: Record<string, string> = {
    kontrol_ortami: 'Kontrol Ortamı',
    risk_degerlendirme: 'Risk Değerlendirme',
    kontrol_faaliyetleri: 'Kontrol Faaliyetleri',
    bilgi_iletisim: 'Bilgi ve İletişim',
    izleme: 'İzleme'
  };

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                İç Kontrol Yönetici Paneli'ni kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !selectedPeriod) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            İç Kontrol - Yönetici Paneli
          </h1>
          <p className="mt-1 text-gray-600">Tüm müdürlüklerin iç kontrol performansı ve uyumluluk durumu</p>
          {selectedPlan && (
            <p className="text-xs text-gray-500 mt-1">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
          )}
        </div>

        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Dönem Seçin</option>
          {periods.map(period => (
            <option key={period.id} value={period.id}>
              {period.title} ({period.year}) {period.is_current && '- Güncel'}
            </option>
          ))}
        </select>
      </div>

      {selectedPeriod && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Toplam Müdürlük</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalDepartments}</p>
                </div>
                <Users className="h-12 w-12 text-blue-600 opacity-80" />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Tamamlanan:</span>
                  <span className="font-semibold text-green-600">{stats.departmentsCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span>Devam Eden:</span>
                  <span className="font-semibold text-yellow-600">{stats.departmentsInProgress}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ort. Tamamlanma</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.avgOverallCompletion.toFixed(0)}%</p>
                </div>
                <Target className="h-12 w-12 text-green-600 opacity-80" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.avgOverallCompletion}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Toplam Değerlendirme</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalAssessments}</p>
                </div>
                <FileText className="h-12 w-12 text-purple-600 opacity-80" />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Onaylanan:</span>
                  <span className="font-semibold text-green-600">{stats.approvedAssessments}</span>
                </div>
                <div className="flex justify-between">
                  <span>İncelemede:</span>
                  <span className="font-semibold text-blue-600">{stats.pendingReviewAssessments}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ort. Uyumluluk Seviyesi</p>
                  <p className={`text-3xl font-bold mt-2 ${getComplianceColor(stats.avgComplianceLevel)}`}>
                    {stats.avgComplianceLevel.toFixed(1)} / 5
                  </p>
                </div>
                <Award className="h-12 w-12 text-yellow-600 opacity-80" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(stats.avgComplianceLevel / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="h-6 w-6 text-blue-600" />
                KİKS Bileşenleri Uyumluluk Durumu
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {kiksCompliance.map((component) => (
                  <div key={component.component} className="text-center p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      {componentNames[component.component] || component.component}
                    </h3>
                    <div className="text-3xl font-bold mb-2" style={{
                      color: component.compliance_percentage >= 80 ? '#10b981' :
                             component.compliance_percentage >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                      {component.compliance_percentage.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-600">
                      {component.approved_assessments} / {component.total_assessments} değerlendirme
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${component.compliance_percentage}%`,
                            backgroundColor: component.compliance_percentage >= 80 ? '#10b981' :
                                           component.compliance_percentage >= 60 ? '#f59e0b' : '#ef4444'
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                Müdürlük Performans Tablosu
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Müdürlük
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tamamlanma
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uyumluluk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kalite Skoru
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Değerlendirmeler
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk/Kontrol
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departmentPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        Henüz veri bulunmamaktadır
                      </td>
                    </tr>
                  ) : (
                    departmentPerformance.map((dept) => (
                      <tr key={dept.department_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{dept.department_name}</div>
                              {dept.is_late && (
                                <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  Gecikmede
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(dept.overall_status)}`}>
                            {getStatusText(dept.overall_status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${dept.overall_completion_pct}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{dept.overall_completion_pct}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-semibold ${getComplianceColor(dept.avg_compliance_level || 0)}`}>
                            {(dept.avg_compliance_level || 0).toFixed(1)} / 5
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{dept.quality_score || 0} / 100</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              {dept.approved_assessments || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              {dept.rejected_assessments || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="space-y-1">
                            <div>Risk: {dept.total_risks || 0}</div>
                            <div>Kontrol: {dept.total_controls || 0}</div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
