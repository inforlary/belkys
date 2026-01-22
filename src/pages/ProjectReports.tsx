import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileBarChart, FileText, Target, TrendingUp, Download, Trash2, Calendar, BarChart3, Clock, FileCheck } from 'lucide-react';
import IlyasReportModal from '../components/project-reports/IlyasReportModal';
import BeyanReportModal from '../components/project-reports/BeyanReportModal';
import SPRealizationReportModal from '../components/project-reports/SPRealizationReportModal';
import PeriodComparisonReportModal from '../components/project-reports/PeriodComparisonReportModal';
import Pagination from '../components/ui/Pagination';

type ReportType = 'ilyas' | 'beyan' | 'sp' | 'period' | null;

interface ProjectStats {
  totalProjects: number;
  monthlyReports: number;
  lastReportDate: string;
  sourceDistribution: { source: string; count: number; percentage: number }[];
  statusDistribution: { status: string; count: number; percentage: number }[];
}

interface ReportHistory {
  id: string;
  report_type: string;
  report_name: string;
  period_info: any;
  format: string;
  file_url: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export default function ProjectReports() {
  const { profile } = useAuth();
  const [activeModal, setActiveModal] = useState<ReportType>(null);
  const [stats, setStats] = useState<ProjectStats>({
    totalProjects: 0,
    monthlyReports: 0,
    lastReportDate: '-',
    sourceDistribution: [],
    statusDistribution: []
  });
  const [recentReports, setRecentReports] = useState<ReportHistory[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (profile?.organization_id) {
      loadStats();
      loadReportHistory();
    }
  }, [profile?.organization_id, currentPage]);

  const loadStats = async () => {
    try {
      setLoading(true);

      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('source, status')
        .eq('organization_id', profile?.organization_id);

      if (projectsError) throw projectsError;

      const totalProjects = projects?.length || 0;

      const sourceMap = new Map<string, number>();
      const statusMap = new Map<string, number>();

      projects?.forEach(p => {
        sourceMap.set(p.source, (sourceMap.get(p.source) || 0) + 1);
        statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
      });

      const sourceDistribution = Array.from(sourceMap.entries()).map(([source, count]) => ({
        source,
        count,
        percentage: Math.round((count / totalProjects) * 100)
      }));

      const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / totalProjects) * 100)
      }));

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyReportsData, error: monthlyError } = await supabase
        .from('project_report_history')
        .select('id')
        .eq('organization_id', profile?.organization_id)
        .gte('created_at', startOfMonth.toISOString());

      if (monthlyError) throw monthlyError;

      const { data: lastReport, error: lastReportError } = await supabase
        .from('project_report_history')
        .select('created_at')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastReportError) throw lastReportError;

      const { data: recent, error: recentError } = await supabase
        .from('project_report_history')
        .select(`
          *,
          profiles:created_by (
            full_name
          )
        `)
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      setStats({
        totalProjects,
        monthlyReports: monthlyReportsData?.length || 0,
        lastReportDate: lastReport ? new Date(lastReport.created_at).toLocaleDateString('tr-TR') : '-',
        sourceDistribution,
        statusDistribution
      });

      setRecentReports(recent || []);
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportHistory = async () => {
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { count } = await supabase
        .from('project_report_history')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile?.organization_id);

      const { data, error } = await supabase
        .from('project_report_history')
        .select(`
          *,
          profiles:created_by (
            full_name
          )
        `)
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setReportHistory(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Rapor geçmişi yüklenemedi:', error);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm('Bu rapor kaydını silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('project_report_history')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Rapor kaydı silindi');
      loadStats();
      loadReportHistory();
    } catch (error: any) {
      console.error('Rapor silinirken hata:', error);
      alert('Hata: ' + error.message);
    }
  };

  const reportCards = [
    {
      id: 'ilyas',
      icon: FileBarChart,
      title: 'İLYAS Raporu',
      description: 'İçişleri Bakanlığı formatında dönemsel yatırım izleme raporu',
      color: 'blue'
    },
    {
      id: 'beyan',
      icon: FileText,
      title: 'Beyanname Raporu',
      description: 'Seçim beyannamesi proje durum raporu',
      color: 'green'
    },
    {
      id: 'sp',
      icon: Target,
      title: 'SP Gerçekleşme Raporu',
      description: 'Stratejik plan hedeflerine göre proje gerçekleşmeleri',
      color: 'purple'
    },
    {
      id: 'period',
      icon: TrendingUp,
      title: 'Dönemsel Karşılaştırma',
      description: 'Dönemler arası performans analizi ve karşılaştırma',
      color: 'orange'
    }
  ];

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
  };

  const sourceLabels: Record<string, string> = {
    ilyas: 'İLYAS',
    beyanname: 'Beyanname',
    genel: 'Genel'
  };

  const statusLabels: Record<string, string> = {
    completed: 'Tamamlandı',
    in_progress: 'Devam Eden',
    planned: 'Planlandı',
    delayed: 'Gecikmiş'
  };

  const reportTypeLabels: Record<string, string> = {
    ilyas: 'İLYAS Raporu',
    beyan: 'Beyanname Raporu',
    sp: 'SP Gerçekleşme',
    period: 'Dönemsel Karşılaştırma'
  };

  const formatLabels: Record<string, string> = {
    excel: 'Excel',
    pdf: 'PDF',
    screen: 'Ekran'
  };

  const getProgressBar = (percentage: number, color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      orange: 'bg-orange-600',
      gray: 'bg-gray-600'
    };
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-3">
          <div
            className={`${colorMap[color]} h-3 rounded-full transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="w-8 h-8" />
          Proje Raporları
        </h1>
        <p className="text-blue-100 mt-2">Proje ve performans raporlarını oluşturun ve takip edin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 font-medium">Toplam Proje</span>
            <FileCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-4xl font-bold text-gray-900">{stats.totalProjects}</div>
          <div className="text-sm text-gray-500 mt-2">Aktif projeler</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 font-medium">Bu Ay Rapor</span>
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-4xl font-bold text-gray-900">{stats.monthlyReports}</div>
          <div className="text-sm text-gray-500 mt-2">Oluşturulan rapor</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 font-medium">Son Rapor</span>
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.lastReportDate}</div>
          <div className="text-sm text-gray-500 mt-2">Tarih</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Hızlı İstatistikler
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Kaynak Dağılımı</h4>
              <div className="space-y-3">
                {stats.sourceDistribution.map((item) => (
                  <div key={item.source}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{sourceLabels[item.source] || item.source}</span>
                      <span className="font-semibold text-gray-900">{item.count} (%{item.percentage})</span>
                    </div>
                    {getProgressBar(item.percentage, 'blue')}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Durum Dağılımı</h4>
              <div className="space-y-3">
                {stats.statusDistribution.map((item) => (
                  <div key={item.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{statusLabels[item.status] || item.status}</span>
                      <span className="font-semibold text-gray-900">{item.count} (%{item.percentage})</span>
                    </div>
                    {getProgressBar(item.percentage, 'green')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            Son Oluşturulan Raporlar
          </h3>

          {recentReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p>Henüz rapor oluşturulmamış</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{reportTypeLabels[report.report_type]}</div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>{new Date(report.created_at).toLocaleDateString('tr-TR')}</span>
                        <span>•</span>
                        <span>{report.profiles?.full_name}</span>
                      </div>
                    </div>
                    {report.file_url && (
                      <a
                        href={report.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {recentReports.length >= 5 && (
                <button
                  type="button"
                  onClick={() => {
                    const historySection = document.getElementById('report-history');
                    historySection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium py-2"
                >
                  Tüm Raporları Gör →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Rapor Türleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                <div className={`bg-gradient-to-r ${colorClasses[card.color as keyof typeof colorClasses]} p-4`}>
                  <div className="flex items-center gap-3 text-white">
                    <Icon className="w-8 h-8" />
                    <h3 className="text-xl font-bold">{card.title}</h3>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-gray-600 mb-6 min-h-[48px]">{card.description}</p>

                  <button
                    type="button"
                    onClick={() => setActiveModal(card.id as ReportType)}
                    className={`w-full bg-gradient-to-r ${colorClasses[card.color as keyof typeof colorClasses]} text-white px-4 py-3 rounded-lg font-medium transition-all hover:shadow-lg`}
                  >
                    Rapor Oluştur
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div id="report-history" className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-gray-600" />
            Rapor Geçmişi
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rapor Türü</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Dönem</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Oluşturan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Format</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reportHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    Henüz rapor kaydı bulunmuyor
                  </td>
                </tr>
              ) : (
                reportHistory.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(report.created_at).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {reportTypeLabels[report.report_type]}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {report.period_info?.period || report.period_info?.year || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {report.profiles?.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatLabels[report.format]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.file_url && (
                          <a
                            href={report.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                            title="İndir"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalCount > pageSize && (
          <div className="border-t border-gray-200 p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / pageSize)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {activeModal === 'ilyas' && (
        <IlyasReportModal onClose={() => { setActiveModal(null); loadStats(); loadReportHistory(); }} />
      )}

      {activeModal === 'beyan' && (
        <BeyanReportModal onClose={() => { setActiveModal(null); loadStats(); loadReportHistory(); }} />
      )}

      {activeModal === 'sp' && (
        <SPRealizationReportModal onClose={() => { setActiveModal(null); loadStats(); loadReportHistory(); }} />
      )}

      {activeModal === 'period' && (
        <PeriodComparisonReportModal onClose={() => { setActiveModal(null); loadStats(); loadReportHistory(); }} />
      )}
    </div>
  );
}
