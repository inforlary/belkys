import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Circle, Calendar, TrendingUp, AlertCircle } from 'lucide-react';

interface Project {
  id: string;
  start_date: string;
  end_date: string;
  physical_progress: number;
  financial_progress: number;
  contract_amount: number;
}

interface ProgressRecord {
  id: string;
  record_date: string;
  new_physical: number;
  new_financial: number;
  expense_amount: number;
  description: string;
  photo_count?: number;
}

interface Milestone {
  date: string;
  title: string;
  completed: boolean;
  progressRecord?: ProgressRecord;
}

export default function TimelineTab({ project }: { project: Project }) {
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgressRecords();
  }, [project.id]);

  const loadProgressRecords = async () => {
    try {
      setLoading(true);

      const { data: progressData, error: progressError } = await supabase
        .from('project_progress')
        .select('*')
        .eq('project_id', project.id)
        .order('record_date', { ascending: true });

      if (progressError) throw progressError;

      const recordsWithPhotos = await Promise.all(
        (progressData || []).map(async (record) => {
          const { count } = await supabase
            .from('project_files')
            .select('id', { count: 'exact', head: true })
            .eq('progress_id', record.id);

          return { ...record, photo_count: count || 0 };
        })
      );

      setProgressRecords(recordsWithPhotos);
    } catch (error) {
      console.error('İlerleme kayıtları yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const startDate = new Date(project.start_date);
  const endDate = new Date(project.end_date);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  const plannedPhysical = timeProgress;
  const plannedFinancial = timeProgress;

  const physicalDiff = project.physical_progress - plannedPhysical;
  const financialDiff = project.financial_progress - plannedFinancial;

  const getStatusInfo = (diff: number) => {
    if (diff < -5) return { icon: '🔴', text: 'Planın Gerisinde', color: 'text-red-600' };
    if (diff > 5) return { icon: '🟢', text: 'Planın Önünde', color: 'text-green-600' };
    return { icon: '🟡', text: 'Plana Yakın', color: 'text-yellow-600' };
  };

  const physicalStatus = getStatusInfo(physicalDiff);
  const financialStatus = getStatusInfo(financialDiff);

  const milestones: Milestone[] = [
    {
      date: project.start_date,
      title: 'Proje Başlangıcı',
      completed: true
    },
    ...progressRecords.map(record => ({
      date: record.record_date,
      title: record.description || `İlerleme Kaydı ${record.new_physical}%`,
      completed: true,
      progressRecord: record
    })),
    {
      date: project.end_date,
      title: 'Proje Teslimi',
      completed: false
    }
  ];

  const sortedMilestones = milestones.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const chartData = progressRecords.map(record => ({
    date: formatDate(record.record_date),
    fiziki: record.new_physical,
    nakdi: record.new_financial
  }));

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Başlangıç</div>
            <div className="text-lg font-bold text-blue-600">{formatDate(project.start_date)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Bugün</div>
            <div className="text-lg font-bold text-gray-900">{formatDate(today.toISOString())}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Bitiş</div>
            <div className="text-lg font-bold text-blue-600">{formatDate(project.end_date)}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-600">Geçen Süre</div>
            <div className="text-xl font-semibold text-gray-900">{elapsedDays} gün</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Toplam Süre</div>
            <div className="text-xl font-semibold text-gray-900">{totalDays} gün</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Kalan Süre</div>
            <div className="text-xl font-semibold text-gray-900">{remainingDays} gün</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Görsel Timeline
        </h3>

        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{formatDate(project.start_date)}</span>
            <span>{formatDate(today.toISOString())}</span>
            <span>{formatDate(project.end_date)}</span>
          </div>

          <div className="relative">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${timeProgress}%` }}
              />
            </div>
            <div
              className="absolute top-0 w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow-lg transform -translate-y-1/4"
              style={{ left: `${timeProgress}%`, marginLeft: '-8px' }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>Başlangıç</span>
            <span className="font-semibold text-blue-600">{timeProgress.toFixed(1)}% süre geçti</span>
            <span>Bitiş</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Durum Karşılaştırma
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 text-gray-700"></th>
                <th className="text-center py-3 px-4 text-gray-700 font-semibold">Planlanan</th>
                <th className="text-center py-3 px-4 text-gray-700 font-semibold">Gerçekleşen</th>
                <th className="text-center py-3 px-4 text-gray-700 font-semibold">Fark</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-4 px-4 font-medium text-gray-900">Fiziki İlerleme</td>
                <td className="text-center py-4 px-4">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                    %{plannedPhysical.toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-4 px-4">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                    %{project.physical_progress.toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-4 px-4">
                  <span className={`inline-flex items-center gap-1 font-semibold ${physicalStatus.color}`}>
                    {physicalDiff > 0 ? '+' : ''}{physicalDiff.toFixed(1)} puan
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-4 px-4 font-medium text-gray-900">Nakdi İlerleme</td>
                <td className="text-center py-4 px-4">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                    %{plannedFinancial.toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-4 px-4">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                    %{project.financial_progress.toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-4 px-4">
                  <span className={`inline-flex items-center gap-1 font-semibold ${financialStatus.color}`}>
                    {financialDiff > 0 ? '+' : ''}{financialDiff.toFixed(1)} puan
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-medium text-gray-900">Süre Kullanımı</td>
                <td className="text-center py-4 px-4">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                    %{timeProgress.toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-4 px-4">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                    %{timeProgress.toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-4 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-600">
                    0 puan
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="font-semibold text-gray-900 mb-2">Durum Değerlendirmesi:</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span>{physicalStatus.icon}</span>
              <span className={`font-medium ${physicalStatus.color}`}>
                Fiziki İlerleme: {physicalStatus.text}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{financialStatus.icon}</span>
              <span className={`font-medium ${financialStatus.color}`}>
                Nakdi İlerleme: {financialStatus.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Kilometre Taşları
        </h3>

        <div className="space-y-6">
          {sortedMilestones.map((milestone, index) => {
            const isCompleted = milestone.completed;
            const isLast = index === sortedMilestones.length - 1;

            return (
              <div key={index} className="relative pl-8">
                {!isLast && (
                  <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-300" />
                )}

                <div className="absolute left-0 top-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 fill-green-100" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="pb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{milestone.title}</div>
                      <div className="text-sm text-gray-500 mt-1">{formatDate(milestone.date)}</div>
                    </div>
                    <div className="text-sm">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                          ✅ Tamamlandı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                          ⏳ Planlanan
                        </span>
                      )}
                    </div>
                  </div>

                  {milestone.progressRecord && (
                    <div className="mt-3 space-y-2 text-sm">
                      {milestone.progressRecord.photo_count! > 0 && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📷</span>
                          <span>{milestone.progressRecord.photo_count} fotoğraf</span>
                        </div>
                      )}
                      {milestone.progressRecord.expense_amount > 0 && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>💰</span>
                          <span>{formatCurrency(milestone.progressRecord.expense_amount)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-gray-600">
                        <div>
                          <span className="text-xs text-gray-500">Fiziki:</span>
                          <span className="ml-1 font-semibold">%{milestone.progressRecord.new_physical}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Nakdi:</span>
                          <span className="ml-1 font-semibold">%{milestone.progressRecord.new_financial}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">İlerleme Grafiği</h3>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                label={{ value: '% İlerleme', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="fiziki"
                name="Fiziki İlerleme"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="nakdi"
                name="Nakdi İlerleme"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="text-center text-sm text-gray-500 mt-4">
            İlerleme kayıtlarına göre zaman içindeki değişim
          </div>
        </div>
      )}
    </div>
  );
}
