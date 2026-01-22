import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { FileSpreadsheet, Printer, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

interface SPRealizationReportModalProps {
  onClose: () => void;
}

interface ObjectiveData {
  id: string;
  code: string;
  name: string;
  realization: number;
  goals: GoalData[];
}

interface GoalData {
  id: string;
  code: string;
  name: string;
  realization: number;
  projects: ProjectData[];
}

interface ProjectData {
  id: string;
  project_no: string;
  project_name: string;
  physical_progress: number;
  status: string;
}

export default function SPRealizationReportModal({ onClose }: SPRealizationReportModalProps) {
  const { profile } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [objective, setObjective] = useState('Tümü');
  const [source, setSource] = useState('Tümü');
  const [format, setFormat] = useState<'screen' | 'excel' | 'pdf'>('screen');
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [objectives, setObjectives] = useState<ObjectiveData[]>([]);
  const [unlinkedProjects, setUnlinkedProjects] = useState<ProjectData[]>([]);
  const [objectiveOptions, setObjectiveOptions] = useState<any[]>([]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (profile?.organization_id) {
      loadObjectives();
    }
  }, [profile?.organization_id]);

  const loadObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('id, code, name')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setObjectiveOptions(data || []);
    } catch (error) {
      console.error('Amaçlar yüklenemedi:', error);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);

      const { data: objectivesData, error: objError } = await supabase
        .from('objectives')
        .select(`
          id,
          code,
          name,
          goals (
            id,
            code,
            name
          )
        `)
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (objError) throw objError;

      const processedObjectives: ObjectiveData[] = [];

      for (const obj of objectivesData || []) {
        const goalsData: GoalData[] = [];

        for (const goal of obj.goals || []) {
          let projectQuery = supabase
            .from('projects')
            .select('id, project_no, project_name, physical_progress, status')
            .eq('organization_id', profile?.organization_id)
            .eq('year', year)
            .contains('related_goal_id', goal.id);

          if (source !== 'Tümü') {
            projectQuery = projectQuery.eq('source', source.toLowerCase());
          }

          const { data: projects, error: projError } = await projectQuery;

          if (!projError && projects) {
            const goalRealization = projects.length > 0
              ? Math.round(projects.reduce((sum, p) => sum + (p.physical_progress || 0), 0) / projects.length)
              : 0;

            goalsData.push({
              id: goal.id,
              code: goal.code,
              name: goal.name,
              realization: goalRealization,
              projects: projects as ProjectData[]
            });
          }
        }

        const objRealization = goalsData.length > 0
          ? Math.round(goalsData.reduce((sum, g) => sum + g.realization, 0) / goalsData.length)
          : 0;

        processedObjectives.push({
          id: obj.id,
          code: obj.code,
          name: obj.name,
          realization: objRealization,
          goals: goalsData
        });
      }

      const { data: unlinkedData } = await supabase
        .from('projects')
        .select('id, project_no, project_name, physical_progress, status')
        .eq('organization_id', profile?.organization_id)
        .eq('year', year)
        .or('related_goal_id.is.null,related_objective_id.is.null')
        .limit(10);

      setObjectives(processedObjectives);
      setUnlinkedProjects(unlinkedData || []);

      if (format === 'screen') {
        setShowReport(true);
      } else if (format === 'excel') {
        exportToExcel(processedObjectives, unlinkedData || []);
      }
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (objectives: ObjectiveData[], unlinked: ProjectData[]) => {
    const wb = XLSX.utils.book_new();

    const summaryData = objectives.map(obj => ({
      'AMAÇ KODU': obj.code,
      'AMAÇ ADI': obj.name,
      'HEDEF SAYISI': obj.goals.length,
      'GERÇEKLEŞME %': obj.realization
    }));

    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const detailData: any[] = [];
    objectives.forEach(obj => {
      obj.goals.forEach(goal => {
        goal.projects.forEach(proj => {
          detailData.push({
            'AMAÇ': obj.code + ' - ' + obj.name,
            'HEDEF': goal.code + ' - ' + goal.name,
            'PROJE NO': proj.project_no,
            'PROJE ADI': proj.project_name,
            'FİZİKİ %': proj.physical_progress,
            'DURUM': proj.status
          });
        });
      });
    });

    const ws2 = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Detay');

    if (unlinked.length > 0) {
      const unlinkedData = unlinked.map(p => ({
        'PROJE NO': p.project_no,
        'PROJE ADI': p.project_name,
        'FİZİKİ %': p.physical_progress,
        'DURUM': p.status
      }));
      const ws3 = XLSX.utils.json_to_sheet(unlinkedData);
      XLSX.utils.book_append_sheet(wb, ws3, 'SP Bağlantısız');
    }

    XLSX.writeFile(wb, `SP_Gerceklesme_Raporu_${year}.xlsx`);
  };

  const getGeneralStats = () => {
    const totalObjectives = objectives.length;
    const totalGoals = objectives.reduce((sum, obj) => sum + obj.goals.length, 0);
    const totalProjects = objectives.reduce((sum, obj) =>
      sum + obj.goals.reduce((gSum, goal) => gSum + goal.projects.length, 0), 0
    );
    const avgRealization = objectives.length > 0
      ? Math.round(objectives.reduce((sum, obj) => sum + obj.realization, 0) / objectives.length)
      : 0;

    return { totalObjectives, totalGoals, totalProjects, avgRealization };
  };

  const getChartData = () => {
    return objectives.map(obj => ({
      name: obj.code,
      gerçekleşme: obj.realization
    }));
  };

  if (showReport) {
    const stats = getGeneralStats();
    const chartData = getChartData();

    return (
      <Modal onClose={() => setShowReport(false)} size="full">
        <div className="bg-white">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
            <button
              onClick={() => setShowReport(false)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ← Geri
            </button>
            <h2 className="text-lg font-semibold">SP Gerçekleşme Raporu - {year}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportToExcel(objectives, unlinkedProjects)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Yazdır
              </button>
            </div>
          </div>

          <div className="p-8">
            <div className="text-center border-b border-gray-300 pb-6 mb-6">
              <h1 className="text-2xl font-bold mb-4">STRATEJİK PLAN GERÇEKLEŞME RAPORU - {year}</h1>
              <div className="text-sm space-y-1">
                <div>KURUM: {profile?.organization_name || 'KÖRFEZ BELEDİYESİ'}</div>
                <div>RAPOR TARİHİ: {new Date().toLocaleDateString('tr-TR')}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">{stats.totalObjectives}</div>
                <div className="text-sm text-gray-600">Amaç</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl font-bold text-green-600">{stats.totalGoals}</div>
                <div className="text-sm text-gray-600">Hedef</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-3xl font-bold text-purple-600">{stats.totalProjects}</div>
                <div className="text-sm text-gray-600">Bağlı Proje</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl font-bold text-orange-600">%{stats.avgRealization}</div>
                <div className="text-sm text-gray-600">Ort. Gerçekleşme</div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Amaç Bazlı Gerçekleşme</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="gerçekleşme" fill="#3b82f6" name="Gerçekleşme %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {objectives.map((obj) => (
              <div key={obj.id} className="mb-8 border border-gray-300 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    {obj.code}: {obj.name}
                  </h3>
                  <div className="text-2xl font-bold text-blue-600">Gerçekleşme: %{obj.realization}</div>
                </div>

                {obj.goals.map((goal) => (
                  <div key={goal.id} className="mb-4 ml-4 border-l-4 border-blue-400 pl-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">
                        {goal.code}: {goal.name}
                      </h4>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Proje Sayısı: {goal.projects.length}</span>
                        <span className="font-bold text-green-600">Gerçekleşme: %{goal.realization}</span>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${goal.realization}%` }}
                      />
                    </div>

                    {goal.projects.length > 0 && (
                      <div className="ml-4 space-y-1">
                        <div className="font-medium text-sm text-gray-700 mb-2">Bağlı Projeler:</div>
                        {goal.projects.map((proj) => (
                          <div key={proj.id} className="flex items-center justify-between text-sm py-1">
                            <span>• {proj.project_no} - {proj.project_name}</span>
                            <span className="font-semibold">
                              %{proj.physical_progress} {proj.status === 'completed' ? '✅' : '🔄'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {unlinkedProjects.length > 0 && (
              <div className="mt-8 p-6 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-lg font-bold text-yellow-800">
                    SP Bağlantısı Olmayan Projeler: {unlinkedProjects.length}
                  </h3>
                </div>

                <div className="space-y-2">
                  {unlinkedProjects.map((proj) => (
                    <div key={proj.id} className="text-sm">
                      • {proj.project_no} - {proj.project_name}
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-sm text-yellow-700">
                  Bu projelere SP bağlantısı yapılması önerilir.
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="SP Gerçekleşme Raporu Oluştur">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Yıl:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amaç:</label>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="Tümü">Tümü</option>
            {objectiveOptions.map(obj => (
              <option key={obj.id} value={obj.id}>{obj.code} - {obj.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Kaynak:</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="Tümü">Tümü</option>
            <option value="İLYAS">İLYAS</option>
            <option value="Beyanname">Beyanname</option>
            <option value="Genel">Genel</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format:</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="screen"
                checked={format === 'screen'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              Ekranda Görüntüle
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="excel"
                checked={format === 'excel'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              Excel (.xlsx)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="pdf"
                checked={format === 'pdf'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              PDF
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Oluşturuluyor...' : 'Raporu Oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
