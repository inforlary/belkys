import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Modal from '../components/ui/Modal';
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

interface Department {
  id: string;
  name: string;
}

export default function ImprovementSuggestions() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'process',
    priority: 'medium',
    department_id: '',
    estimated_benefit: '',
    implementation_cost: ''
  });

  useEffect(() => {
    if (organization?.id) {
      fetchSuggestions();
      fetchDepartments();
    }
  }, [organization?.id]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization?.id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const { data: lastSuggestion } = await supabase
        .from('improvement_suggestions')
        .select('suggestion_code')
        .eq('organization_id', organization?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let suggestionNumber = 1;
      if (lastSuggestion?.suggestion_code) {
        const match = lastSuggestion.suggestion_code.match(/IO-(\d+)/);
        if (match) {
          suggestionNumber = parseInt(match[1]) + 1;
        }
      }

      const suggestion_code = `IO-${suggestionNumber.toString().padStart(4, '0')}`;

      const { error } = await supabase
        .from('improvement_suggestions')
        .insert({
          organization_id: organization?.id,
          suggestion_code,
          title: form.title,
          description: form.description,
          category: form.category,
          priority: form.priority,
          department_id: form.department_id || null,
          estimated_benefit: form.estimated_benefit,
          implementation_cost: form.implementation_cost,
          suggested_by: user?.id,
          status: 'submitted'
        });

      if (error) throw error;

      setShowModal(false);
      setForm({
        title: '',
        description: '',
        category: 'process',
        priority: 'medium',
        department_id: '',
        estimated_benefit: '',
        implementation_cost: ''
      });
      fetchSuggestions();
      alert('İyileştirme önerisi başarıyla gönderildi!');
    } catch (error) {
      console.error('Error creating suggestion:', error);
      alert('İyileştirme önerisi gönderilirken hata oluştu!');
    } finally {
      setSaving(false);
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
      'environment': 'Çevre',
      'efficiency': 'Verimlilik',
      'customer_satisfaction': 'Müşteri Memnuniyeti'
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

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      'critical': 'Kritik',
      'high': 'Yüksek',
      'medium': 'Orta',
      'low': 'Düşük'
    };
    return labels[priority] || priority;
  };

  const stats = {
    total: suggestions.length,
    submitted: suggestions.filter(s => s.status === 'submitted').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    implemented: suggestions.filter(s => s.status === 'implemented').length
  };

  return (
    <>
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
                          {getPriorityLabel(suggestion.priority)}
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

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Yeni İyileştirme Önerisi"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Öneri Başlığı *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              placeholder="Öneriniz için kısa bir başlık..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              required
              placeholder="Önerinizi detaylı olarak açıklayınız..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="process">Süreç İyileştirme</option>
                <option value="quality">Kalite İyileştirme</option>
                <option value="cost">Maliyet Azaltma</option>
                <option value="safety">Güvenlik</option>
                <option value="environment">Çevre</option>
                <option value="efficiency">Verimlilik</option>
                <option value="customer_satisfaction">Müşteri Memnuniyeti</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Öncelik *
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlgili Birim
            </label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçiniz...</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beklenen Fayda
            </label>
            <textarea
              value={form.estimated_benefit}
              onChange={(e) => setForm({ ...form, estimated_benefit: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Bu öneri uygulandığında ne gibi faydalar sağlayacak?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tahmini Maliyet
            </label>
            <input
              type="text"
              value={form.implementation_cost}
              onChange={(e) => setForm({ ...form, implementation_cost: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ör: Düşük, 10.000 TL, Maliyet yok"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
