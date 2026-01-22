import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Edit, Plus, TrendingUp, DollarSign, Clock } from 'lucide-react';
import GeneralInfoTab from '../components/project-detail/GeneralInfoTab';
import ProgressRecordsTab from '../components/project-detail/ProgressRecordsTab';
import FilesTab from '../components/project-detail/FilesTab';
import TimelineTab from '../components/project-detail/TimelineTab';
import SPConnectionTab from '../components/project-detail/SPConnectionTab';

interface Project {
  id: string;
  project_no: string;
  project_name: string;
  source: string;
  responsible_unit: string;
  physical_progress: number;
  financial_progress: number;
  contract_amount: number;
  total_expense: number;
  start_date: string;
  end_date: string;
  status: string;
  year: number;
  period: number;
  sector: string;
  sub_sector: string;
  location: string;
  tender_date: string;
  tender_type: string;
  contractor: string;
  description: string;
  strategic_plan_id?: string;
  last_update_date: string;
}

const SOURCE_COLORS = {
  ilyas: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  beyanname: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  genel: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
};

const SOURCE_LABELS = {
  ilyas: 'İLYAS',
  beyanname: 'Beyanname',
  genel: 'Genel'
};

const STATUS_CONFIG = {
  completed: { label: 'Tamamlandı', bg: 'bg-green-100', text: 'text-green-800' },
  in_progress: { label: 'Devam Ediyor', bg: 'bg-orange-100', text: 'text-orange-800' },
  planned: { label: 'Planlandı', bg: 'bg-gray-100', text: 'text-gray-800' },
  delayed: { label: 'Gecikmiş', bg: 'bg-red-100', text: 'text-red-800' }
};

const TABS = [
  { id: 'general', label: 'Genel Bilgiler' },
  { id: 'progress', label: 'İlerleme Kayıtları' },
  { id: 'files', label: 'Dosyalar' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'sp', label: 'SP Bağlantısı' }
];

export default function ProjectDetail() {
  const { profile } = useAuth();
  const { navigate, getPathParam } = useLocation();
  const projectId = getPathParam();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    console.log('[ProjectDetail] projectId:', projectId);
    console.log('[ProjectDetail] organization_id:', profile?.organization_id);

    if (!projectId) {
      console.error('[ProjectDetail] Proje ID bulunamadı!');
      alert('Proje ID bulunamadı');
      navigate('project-management/projects');
      return;
    }

    if (projectId && profile?.organization_id) {
      loadProject();
    }
  }, [projectId, profile?.organization_id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      console.log('[ProjectDetail] Proje yükleniyor, ID:', projectId);

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('organization_id', profile?.organization_id)
        .single();

      if (error) {
        console.error('[ProjectDetail] Supabase hatası:', error);
        throw error;
      }

      if (!data) {
        console.error('[ProjectDetail] Proje bulunamadı');
        throw new Error('Proje bulunamadı');
      }

      console.log('[ProjectDetail] Proje yüklendi:', data);
      setProject(data);
    } catch (error: any) {
      console.error('[ProjectDetail] Proje yüklenirken hata:', error);
      alert(`Proje bulunamadı: ${error.message || 'Bilinmeyen hata'}`);
      navigate('project-management/projects');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingDays = () => {
    if (!project) return 0;
    const end = new Date(project.end_date);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Proje bulunamadı</p>
      </div>
    );
  }

  const sourceColors = SOURCE_COLORS[project.source as keyof typeof SOURCE_COLORS] || SOURCE_COLORS.genel;
  const statusConfig = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planned;
  const remainingDays = getRemainingDays();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('project-management/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {project.project_no} - {project.project_name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sourceColors.bg} ${sourceColors.text} ${sourceColors.border}`}>
                {SOURCE_LABELS[project.source as keyof typeof SOURCE_LABELS] || project.source}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`project-management/projects/${project.id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Düzenle
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            İlerleme Ekle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Fiziki İlerleme</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-3">
            %{project.physical_progress || 0}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${project.physical_progress || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Nakdi İlerleme</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-3">
            %{project.financial_progress || 0}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${project.financial_progress || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Sözleşme Tutarı</span>
            <DollarSign className="w-5 h-5 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {project.contract_amount ?
              `${(project.contract_amount / 1000000).toFixed(1)}M ₺` :
              '-'
            }
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Kalan Süre</span>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div className={`text-2xl font-bold ${remainingDays < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {Math.abs(remainingDays)} gün
          </div>
          {remainingDays < 0 && (
            <span className="text-xs text-red-600">Gecikmiş</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && <GeneralInfoTab project={project} />}
          {activeTab === 'progress' && <ProgressRecordsTab projectId={project.id} onUpdate={loadProject} />}
          {activeTab === 'files' && <FilesTab projectId={project.id} />}
          {activeTab === 'timeline' && <TimelineTab project={project} />}
          {activeTab === 'sp' && <SPConnectionTab project={project} onUpdate={loadProject} />}
        </div>
      </div>
    </div>
  );
}
