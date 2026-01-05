import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { BookOpen, Plus, TrendingUp, AlertCircle, CheckCircle, Star } from 'lucide-react';

interface Lesson {
  id: string;
  lesson_code: string;
  lesson_title: string;
  source_type: string;
  category: string;
  priority: string;
  status: string;
  lesson_learned: string;
  recommendations: string;
  date_identified: string;
  department: {
    name: string;
  } | null;
}

interface BestPractice {
  id: string;
  practice_code: string;
  practice_title: string;
  category: string;
  status: string;
  implementation_count: number;
  average_success_rate: number | null;
}

export default function LessonsLearned() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lessons' | 'practices'>('lessons');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [practices, setPractices] = useState<BestPractice[]>([]);

  useEffect(() => {
    if (organization?.id) {
      fetchData();
    }
  }, [organization?.id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'lessons') {
        const { data, error } = await supabase
          .from('lessons_learned')
          .select(`
            *,
            department:departments!department_id(name)
          `)
          .eq('organization_id', organization?.id)
          .order('date_identified', { ascending: false });

        if (error) throw error;
        setLessons(data || []);
      }

      if (activeTab === 'practices') {
        const { data, error } = await supabase
          .from('best_practices')
          .select('*')
          .eq('organization_id', organization?.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPractices(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'project': 'Proje',
      'incident': 'Olay',
      'audit': 'Denetim',
      'complaint': 'Şikayet',
      'near_miss': 'Ramak Kala',
      'success': 'Başarı',
      'failure': 'Başarısızlık'
    };
    return labels[type] || type;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'process': 'Süreç',
      'people': 'İnsan Kaynakları',
      'technology': 'Teknoloji',
      'strategy': 'Strateji',
      'risk': 'Risk',
      'quality': 'Kalite',
      'project_management': 'Proje Yönetimi',
      'efficiency': 'Verimlilik',
      'safety': 'Güvenlik',
      'customer_service': 'Müşteri Hizmetleri',
      'innovation': 'İnovasyon',
      'risk_management': 'Risk Yönetimi'
    };
    return labels[category] || category;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-purple-100 text-purple-800';
      case 'documented': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-gray-200 text-gray-600';
      case 'active': return 'bg-green-100 text-green-800';
      case 'validated': return 'bg-blue-100 text-blue-800';
      case 'proposed': return 'bg-yellow-100 text-yellow-800';
      case 'retired': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'documented': 'Dokümante Edildi',
      'reviewed': 'Gözden Geçirildi',
      'approved': 'Onaylandı',
      'implemented': 'Uygulandı',
      'archived': 'Arşivlendi',
      'proposed': 'Önerildi',
      'validated': 'Doğrulandı',
      'active': 'Aktif',
      'retired': 'Kullanım Dışı'
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sürekli İyileştirme</h1>
            <p className="mt-2 text-gray-600">
              Öğrenilen dersler ve en iyi uygulamalar
            </p>
          </div>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Yeni Ekle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Öğrenilen Dersler</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{lessons.length}</p>
              </div>
              <BookOpen className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En İyi Uygulamalar</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{practices.length}</p>
              </div>
              <Star className="w-10 h-10 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uygulandı</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {lessons.filter(l => l.status === 'implemented').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aktif Uygulamalar</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {practices.filter(p => p.status === 'active').length}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('lessons')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'lessons'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Öğrenilen Dersler
              </button>
              <button
                onClick={() => setActiveTab('practices')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'practices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                En İyi Uygulamalar
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'lessons' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                ) : lessons.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Henüz öğrenilen ders kaydı yok</div>
                ) : (
                  lessons.map((lesson) => (
                    <div key={lesson.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-semibold">{lesson.lesson_title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(lesson.status)}`}>
                              {getStatusLabel(lesson.status)}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Kod</p>
                              <p className="text-sm font-medium">{lesson.lesson_code}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Kaynak</p>
                              <p className="text-sm font-medium">{getSourceTypeLabel(lesson.source_type)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Kategori</p>
                              <p className="text-sm font-medium">{getCategoryLabel(lesson.category)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Öncelik</p>
                              <p className={`text-sm font-medium ${getPriorityColor(lesson.priority)}`}>
                                {lesson.priority.toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-600 font-semibold">Öğrenilen Ders:</p>
                            <p className="text-sm text-gray-900 mt-1">{lesson.lesson_learned}</p>
                          </div>

                          <div className="mt-2 p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-gray-600 font-semibold">Öneriler:</p>
                            <p className="text-sm text-gray-900 mt-1">{lesson.recommendations}</p>
                          </div>

                          <div className="mt-3 text-xs text-gray-500">
                            Tarih: {new Date(lesson.date_identified).toLocaleDateString('tr-TR')}
                            {lesson.department && ` - Birim: ${lesson.department.name}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'practices' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">Yükleniyor...</div>
                ) : practices.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500">Henüz en iyi uygulama kaydı yok</div>
                ) : (
                  practices.map((practice) => (
                    <div key={practice.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <Star className="w-5 h-5 text-yellow-500" />
                            <h3 className="text-lg font-semibold">{practice.practice_title}</h3>
                          </div>
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(practice.status)}`}>
                            {getStatusLabel(practice.status)}
                          </span>

                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Kod</p>
                              <p className="text-sm font-medium">{practice.practice_code}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Kategori</p>
                              <p className="text-sm font-medium">{getCategoryLabel(practice.category)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Uygulama Sayısı</p>
                              <p className="text-sm font-medium">{practice.implementation_count}</p>
                            </div>
                            {practice.average_success_rate && (
                              <div>
                                <p className="text-xs text-gray-500">Başarı Oranı</p>
                                <p className="text-sm font-medium">{practice.average_success_rate.toFixed(0)}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}