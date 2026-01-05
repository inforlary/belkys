import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Lightbulb, Plus, ThumbsUp, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Suggestion {
  id: string;
  suggestion_code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  estimated_benefit: string;
  suggested_by: string;
  profiles?: {
    full_name: string;
  };
  department?: {
    name: string;
  };
  created_at: string;
}

export default function ImprovementSuggestions() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      fetchSuggestions();
    }
  }, [organization?.id]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('improvement_suggestions')
        .select(`
          *,
          profiles:suggested_by(full_name),
          department:departments!department_id(name)
        `)
        .eq('organization_id', organization?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'submitted': 'Gönderildi',
      'under_review': 'İnceleniyor',
      'approved': 'Onaylandı',
      'implemented': 'Uygulandı',
      'rejected': 'Reddedildi'
    };
    return labels[status] || status;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'process': 'Süreç',
      'quality': 'Kalite',
      'cost': 'Maliyet',
      'safety': 'Güvenlik',
      'environment': 'Çevre'
    };
    return labels[category] || category;
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

  const stats = {
    total: suggestions.length,
    submitted: suggestions.filter(s => s.status === 'submitted').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    implemented: suggestions.filter(s => s.status === 'implemented').length
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">İyileştirme Önerileri</h1>
            <p className="mt-2 text-gray-600">
              Çalışanların sürekli iyileştirme önerileri ve takibi
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Öneri
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Öneri</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <Lightbulb className="w-10 h-10 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gönderildi</p>
                <p className="text-3xl font-bold text-gray-600 mt-2">{stats.submitted}</p>
              </div>
              <Clock className="w-10 h-10 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Onaylandı</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.approved}</p>
              </div>
              <ThumbsUp className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uygulandı</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.implemented}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
          ) : suggestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Henüz iyileştirme önerisi bulunmuyor
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                      <h3 className="text-lg font-semibold text-gray-900">{suggestion.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(suggestion.status)}`}>
                        {getStatusLabel(suggestion.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-gray-700">{suggestion.description}</p>

                    <div className="mt-4 flex items-center flex-wrap gap-4">
                      <div>
                        <span className="text-xs text-gray-500">Kod: </span>
                        <span className="text-sm font-medium">{suggestion.suggestion_code}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Kategori: </span>
                        <span className="text-sm font-medium">{getCategoryLabel(suggestion.category)}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Öncelik: </span>
                        <span className={`text-sm font-medium ${getPriorityColor(suggestion.priority)}`}>
                          {suggestion.priority.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Öneren: </span>
                        <span className="text-sm font-medium">{suggestion.profiles?.full_name || 'N/A'}</span>
                      </div>
                      {suggestion.department && (
                        <div>
                          <span className="text-xs text-gray-500">Birim: </span>
                          <span className="text-sm font-medium">{suggestion.department.name}</span>
                        </div>
                      )}
                    </div>

                    {suggestion.estimated_benefit && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-gray-600">Beklenen Fayda:</p>
                        <p className="text-sm text-gray-900 mt-1">{suggestion.estimated_benefit}</p>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                      {new Date(suggestion.created_at).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}