import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import {
  Award,
  Plus,
  FileText,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Target,
  Star
} from 'lucide-react';

interface QualityObjective {
  id: string;
  title: string;
  target_value: number;
  achievement_percentage: number;
  status: string;
  responsible_user_id: string;
  profiles?: {
    full_name: string;
  };
}

interface CustomerSurvey {
  id: string;
  survey_title: string;
  survey_date: string;
  satisfaction_score: number;
  total_responses: number;
  stakeholder_type: string;
}

interface ISOStandard {
  id: string;
  standard_code: string;
  standard_name: string;
  category: string;
  is_active: boolean;
}

interface QualityIndicator {
  id: string;
  name: string;
  target_value: number;
  measurement_frequency: string;
}

export default function QualityManagement() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'objectives' | 'surveys' | 'standards' | 'indicators'>('overview');

  const [objectives, setObjectives] = useState<QualityObjective[]>([]);
  const [surveys, setSurveys] = useState<CustomerSurvey[]>([]);
  const [standards, setStandards] = useState<ISOStandard[]>([]);
  const [indicators, setIndicators] = useState<QualityIndicator[]>([]);

  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      fetchData();
    }
  }, [organization?.id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'overview' || activeTab === 'objectives') {
        const { data: objData, error: objError } = await supabase
          .from('quality_objectives')
          .select(`
            *,
            profiles:responsible_user_id(full_name)
          `)
          .eq('organization_id', organization?.id)
          .order('created_at', { ascending: false });

        if (objError) throw objError;
        setObjectives(objData || []);
      }

      if (activeTab === 'overview' || activeTab === 'surveys') {
        const { data: surveyData, error: surveyError } = await supabase
          .from('customer_satisfaction_surveys')
          .select('*')
          .eq('organization_id', organization?.id)
          .order('survey_date', { ascending: false });

        if (surveyError) throw surveyError;
        setSurveys(surveyData || []);
      }

      if (activeTab === 'standards') {
        const { data: stdData, error: stdError } = await supabase
          .from('iso_standards')
          .select('*')
          .or(`organization_id.is.null,organization_id.eq.${organization?.id}`)
          .eq('is_active', true)
          .order('standard_code');

        if (stdError) throw stdError;
        setStandards(stdData || []);
      }

      if (activeTab === 'indicators') {
        const { data: indData, error: indError } = await supabase
          .from('quality_indicators')
          .select('*')
          .eq('organization_id', organization?.id)
          .order('created_at', { ascending: false });

        if (indError) throw indError;
        setIndicators(indData || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'achieved': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'planned': return 'bg-gray-100 text-gray-800';
      case 'not_achieved': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'achieved': return 'Başarıldı';
      case 'in_progress': return 'Devam Ediyor';
      case 'planned': return 'Planlandı';
      case 'not_achieved': return 'Başarılamadı';
      default: return status;
    }
  };

  const averageSatisfactionScore = surveys.length > 0
    ? surveys.reduce((sum, s) => sum + (s.satisfaction_score || 0), 0) / surveys.length
    : 0;

  const objectivesAchieved = objectives.filter(o => o.status === 'achieved').length;
  const objectivesTotal = objectives.length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kalite Yönetimi Sistemi</h1>
            <p className="mt-2 text-gray-600">
              ISO standartları, kalite hedefleri ve müşteri memnuniyeti yönetimi
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kalite Hedefleri</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {objectivesAchieved}/{objectivesTotal}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {objectivesTotal > 0 ? Math.round((objectivesAchieved / objectivesTotal) * 100) : 0}% başarıldı
                </p>
              </div>
              <Target className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Müşteri Memnuniyeti</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {averageSatisfactionScore.toFixed(1)}/10
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {surveys.length} anket
                </p>
              </div>
              <Star className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ISO Standartları</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {standards.length}
                </p>
                <p className="text-sm text-gray-500 mt-1">Aktif standart</p>
              </div>
              <Award className="w-12 h-12 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kalite Göstergeleri</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {indicators.length}
                </p>
                <p className="text-sm text-gray-500 mt-1">İzlenen gösterge</p>
              </div>
              <BarChart3 className="w-12 h-12 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Genel Bakış
              </button>
              <button
                onClick={() => setActiveTab('objectives')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'objectives'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Kalite Hedefleri
              </button>
              <button
                onClick={() => setActiveTab('surveys')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'surveys'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Müşteri Anketleri
              </button>
              <button
                onClick={() => setActiveTab('standards')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'standards'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                ISO Standartları
              </button>
              <button
                onClick={() => setActiveTab('indicators')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'indicators'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Kalite Göstergeleri
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Kalite Hedefleri Durumu</h3>
                  <div className="space-y-3">
                    {objectives.slice(0, 5).map((obj) => (
                      <div key={obj.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{obj.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Hedef: {obj.target_value} - Başarı: {obj.achievement_percentage}%
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(obj.status)}`}>
                          {getStatusLabel(obj.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Son Müşteri Anketleri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {surveys.slice(0, 4).map((survey) => (
                      <div key={survey.id} className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium">{survey.survey_title}</h4>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            {new Date(survey.survey_date).toLocaleDateString('tr-TR')}
                          </span>
                          <span className="text-lg font-bold text-yellow-600">
                            {survey.satisfaction_score}/10
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {survey.total_responses} yanıt - {survey.stakeholder_type}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'objectives' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Kalite Hedefleri</h3>
                  <button
                    onClick={() => setShowObjectiveModal(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Hedef
                  </button>
                </div>

                <div className="space-y-3">
                  {objectives.map((obj) => (
                    <div key={obj.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{obj.title}</h4>
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Hedef Değer</p>
                              <p className="font-medium">{obj.target_value}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Başarı Oranı</p>
                              <p className="font-medium">{obj.achievement_percentage}%</p>
                            </div>
                          </div>
                          {obj.profiles && (
                            <p className="text-sm text-gray-600 mt-2">
                              Sorumlu: {obj.profiles.full_name}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(obj.status)}`}>
                          {getStatusLabel(obj.status)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {objectives.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      Henüz kalite hedefi tanımlanmamış
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'surveys' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Müşteri Memnuniyeti Anketleri</h3>
                  <button
                    onClick={() => setShowSurveyModal(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Anket
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {surveys.map((survey) => (
                    <div key={survey.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <h4 className="font-semibold">{survey.survey_title}</h4>
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Memnuniyet Skoru</p>
                          <p className="text-2xl font-bold text-yellow-600">{survey.satisfaction_score}/10</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Yanıt Sayısı</p>
                          <p className="text-xl font-bold">{survey.total_responses}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500">
                          {new Date(survey.survey_date).toLocaleDateString('tr-TR')} - {survey.stakeholder_type}
                        </p>
                      </div>
                    </div>
                  ))}

                  {surveys.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-gray-500">
                      Henüz müşteri anketi yapılmamış
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'standards' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">ISO ve Kalite Standartları</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {standards.map((std) => (
                    <div key={std.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">{std.standard_code}</h4>
                          <p className="text-gray-700 mt-1">{std.standard_name}</p>
                          <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {std.category}
                          </span>
                        </div>
                        <Award className="w-8 h-8 text-purple-500" />
                      </div>
                    </div>
                  ))}

                  {standards.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-gray-500">
                      Henüz standart tanımlanmamış
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'indicators' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Kalite Göstergeleri</h3>
                <div className="space-y-3">
                  {indicators.map((ind) => (
                    <div key={ind.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{ind.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Hedef: {ind.target_value} - Ölçüm: {ind.measurement_frequency}
                        </p>
                      </div>
                      <BarChart3 className="w-6 h-6 text-gray-400" />
                    </div>
                  ))}

                  {indicators.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      Henüz kalite göstergesi tanımlanmamış
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}