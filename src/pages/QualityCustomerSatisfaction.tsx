import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Star, MessageSquare, TrendingUp } from 'lucide-react';

export default function QualityCustomerSatisfaction() {
  const { profile } = useAuth();
  const [feedback, setFeedback] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feedback');

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [feedbackData, surveysData] = await Promise.all([
        supabase
          .from('quality_customer_feedback')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('received_date', { ascending: false }),
        supabase
          .from('quality_customer_surveys')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('created_at', { ascending: false })
      ]);

      if (feedbackData.error) throw feedbackData.error;
      if (surveysData.error) throw surveysData.error;

      setFeedback(feedbackData.data || []);
      setSurveys(surveysData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const averageSatisfaction = feedback.length > 0
    ? feedback.filter(f => f.satisfaction_score).reduce((acc, f) => acc + f.satisfaction_score, 0) / feedback.filter(f => f.satisfaction_score).length
    : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Müşteri Memnuniyeti</h1>
          <p className="mt-2 text-gray-600">Geri bildirim ve memnuniyet yönetimi</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Yeni Kayıt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Ortalama Skor</span>
            <Star className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{averageSatisfaction.toFixed(1)}</div>
          <p className="text-xs text-gray-500 mt-1">5 üzerinden</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Toplam Geri Bildirim</span>
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{feedback.length}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Şikayetler</span>
            <MessageSquare className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">
            {feedback.filter(f => f.feedback_type === 'complaint').length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Aktif Anketler</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">
            {surveys.filter(s => s.status === 'active').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-4 py-4 border-b-2 transition-colors ${
                activeTab === 'feedback'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Geri Bildirimler
            </button>
            <button
              onClick={() => setActiveTab('surveys')}
              className={`px-4 py-4 border-b-2 transition-colors ${
                activeTab === 'surveys'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Anketler
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'feedback' ? (
            <div className="space-y-4">
              {feedback.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Henüz geri bildirim yok</div>
              ) : (
                feedback.map(item => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          item.feedback_type === 'complaint' ? 'bg-red-100 text-red-800' :
                          item.feedback_type === 'suggestion' ? 'bg-blue-100 text-blue-800' :
                          item.feedback_type === 'compliment' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.feedback_type}
                        </span>
                        <span className="ml-2 text-sm font-medium text-gray-900">{item.feedback_number}</span>
                      </div>
                      {item.satisfaction_score && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{item.satisfaction_score}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mb-1">{item.subject}</div>
                    <div className="text-sm text-gray-600 mb-2">{item.description}</div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{item.customer_name || 'Anonim'}</span>
                      <span>•</span>
                      <span>{item.received_date}</span>
                      <span>•</span>
                      <span className={`${
                        item.status === 'open' ? 'text-red-600' :
                        item.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {surveys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Henüz anket yok</div>
              ) : (
                surveys.map(survey => (
                  <div key={survey.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 mb-1">{survey.title}</div>
                        <div className="text-xs text-gray-600">{survey.description}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{survey.period_start} - {survey.period_end}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        survey.status === 'active' ? 'bg-green-100 text-green-800' :
                        survey.status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {survey.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
