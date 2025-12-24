import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, MessageSquare, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

interface PESTLEAnalysis {
  id: string;
  strategic_plan_id: string;
  category: 'political' | 'economic' | 'social' | 'technological' | 'legal' | 'environmental';
  title: string;
  description: string;
  impact_level: 'high' | 'medium' | 'low';
  priority: number;
  created_by: string;
  created_at: string;
}

interface StrategicPlan {
  id: string;
  name: string;
  status: string;
}

const categoryLabels = {
  political: 'Politik',
  economic: 'Ekonomik',
  social: 'Sosyal',
  technological: 'Teknolojik',
  legal: 'Yasal',
  environmental: 'Çevresel'
};

const categoryColors = {
  political: 'bg-red-100 text-red-800 border-red-300',
  economic: 'bg-blue-100 text-blue-800 border-blue-300',
  social: 'bg-green-100 text-green-800 border-green-300',
  technological: 'bg-purple-100 text-purple-800 border-purple-300',
  legal: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  environmental: 'bg-teal-100 text-teal-800 border-teal-300'
};

const impactLevelLabels = {
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük'
};

const impactLevelColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
};

export default function PESTLEAnalysis() {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [analyses, setAnalyses] = useState<PESTLEAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PESTLEAnalysis | null>(null);
  const [formData, setFormData] = useState({
    category: 'political' as PESTLEAnalysis['category'],
    title: '',
    description: '',
    impact_level: 'medium' as PESTLEAnalysis['impact_level'],
    priority: 0
  });

  useEffect(() => {
    loadPlans();
  }, [profile]);

  useEffect(() => {
    if (selectedPlan) {
      loadAnalyses();
    }
  }, [selectedPlan]);

  const loadPlans = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('strategic_plans')
      .select('id, name, status')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPlans(data);
      if (data.length > 0 && !selectedPlan) {
        setSelectedPlan(data[0].id);
      }
    }
  };

  const loadAnalyses = async () => {
    if (!selectedPlan) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('pestle_analyses')
      .select('*')
      .eq('strategic_plan_id', selectedPlan)
      .order('category')
      .order('priority', { ascending: false });

    if (!error && data) {
      setAnalyses(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !selectedPlan) return;

    const payload = {
      ...formData,
      strategic_plan_id: selectedPlan,
      organization_id: profile.organization_id,
      created_by: user?.id
    };

    if (editingItem) {
      const { error } = await supabase
        .from('pestle_analyses')
        .update(payload)
        .eq('id', editingItem.id);

      if (!error) {
        setShowModal(false);
        loadAnalyses();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('pestle_analyses')
        .insert([payload]);

      if (!error) {
        setShowModal(false);
        loadAnalyses();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu analizi silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('pestle_analyses')
      .delete()
      .eq('id', id);

    if (!error) {
      loadAnalyses();
    }
  };

  const handleEdit = (item: PESTLEAnalysis) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      title: item.title,
      description: item.description,
      impact_level: item.impact_level,
      priority: item.priority
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      category: 'political',
      title: '',
      description: '',
      impact_level: 'medium',
      priority: 0
    });
    setEditingItem(null);
  };

  const groupedAnalyses = analyses.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PESTLEAnalysis[]>);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PESTLE Analizi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Çevre analizi - Politik, Ekonomik, Sosyal, Teknolojik, Yasal ve Çevresel faktörler
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Analiz
          </Button>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Stratejik Plan
        </label>
        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(categoryLabels).map(([category, label]) => (
            <Card key={category} className={`${categoryColors[category as keyof typeof categoryColors]} border-2`}>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">{label}</h3>
                <div className="space-y-3">
                  {groupedAnalyses[category]?.map((item) => (
                    <div key={item.id} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{item.title}</h4>
                        {canEdit && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${impactLevelColors[item.impact_level]}`}>
                          Etki: {impactLevelLabels[item.impact_level]}
                        </span>
                        <span className="text-xs text-gray-500">
                          Öncelik: {item.priority}
                        </span>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-500 italic">Henüz analiz eklenmemiş</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingItem ? 'Analizi Düzenle' : 'Yeni PESTLE Analizi'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as PESTLEAnalysis['category'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Başlık
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etki Seviyesi
            </label>
            <select
              value={formData.impact_level}
              onChange={(e) => setFormData({ ...formData, impact_level: e.target.value as PESTLEAnalysis['impact_level'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              {Object.entries(impactLevelLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Öncelik (0-100)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              İptal
            </Button>
            <Button type="submit">
              {editingItem ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
