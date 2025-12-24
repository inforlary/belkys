import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

interface SWOTAnalysis {
  id: string;
  strategic_plan_id: string;
  category: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact_weight: number;
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
  strength: 'Güçlü Yönler',
  weakness: 'Zayıf Yönler',
  opportunity: 'Fırsatlar',
  threat: 'Tehditler'
};

const categoryIcons = {
  strength: TrendingUp,
  weakness: TrendingDown,
  opportunity: Target,
  threat: AlertTriangle
};

const categoryColors = {
  strength: 'bg-green-50 border-green-200',
  weakness: 'bg-yellow-50 border-yellow-200',
  opportunity: 'bg-blue-50 border-blue-200',
  threat: 'bg-red-50 border-red-200'
};

const categoryTextColors = {
  strength: 'text-green-700',
  weakness: 'text-yellow-700',
  opportunity: 'text-blue-700',
  threat: 'text-red-700'
};

export default function SWOTAnalysis() {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [analyses, setAnalyses] = useState<SWOTAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SWOTAnalysis | null>(null);
  const [formData, setFormData] = useState({
    category: 'strength' as SWOTAnalysis['category'],
    title: '',
    description: '',
    impact_weight: 3,
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
      .from('swot_analyses')
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
        .from('swot_analyses')
        .update(payload)
        .eq('id', editingItem.id);

      if (!error) {
        setShowModal(false);
        loadAnalyses();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('swot_analyses')
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
      .from('swot_analyses')
      .delete()
      .eq('id', id);

    if (!error) {
      loadAnalyses();
    }
  };

  const handleEdit = (item: SWOTAnalysis) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      title: item.title,
      description: item.description,
      impact_weight: item.impact_weight,
      priority: item.priority
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      category: 'strength',
      title: '',
      description: '',
      impact_weight: 3,
      priority: 0
    });
    setEditingItem(null);
  };

  const groupedAnalyses = analyses.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, SWOTAnalysis[]>);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SWOT/GZFT Analizi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Durum analizi - Güçlü yönler, Zayıf yönler, Fırsatlar ve Tehditler
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(categoryLabels).map(([category, label]) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            return (
              <Card
                key={category}
                className={`${categoryColors[category as keyof typeof categoryColors]} border-2`}
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <Icon className={`h-6 w-6 mr-2 ${categoryTextColors[category as keyof typeof categoryTextColors]}`} />
                    <h3 className={`text-xl font-semibold ${categoryTextColors[category as keyof typeof categoryTextColors]}`}>
                      {label}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {groupedAnalyses[category]?.map((item) => (
                      <div key={item.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900 flex-1">{item.title}</h4>
                          {canEdit && (
                            <div className="flex space-x-1 ml-2">
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
                          <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Etki:</span>
                            <div className="flex space-x-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={star <= item.impact_weight ? 'text-yellow-400' : 'text-gray-300'}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-gray-500">
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
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingItem ? 'Analizi Düzenle' : 'Yeni SWOT Analizi'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as SWOTAnalysis['category'] })}
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
              Etki Ağırlığı (1-5)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="1"
                max="5"
                value={formData.impact_weight}
                onChange={(e) => setFormData({ ...formData, impact_weight: parseInt(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-medium text-gray-700 w-8 text-center">
                {formData.impact_weight}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Düşük</span>
              <span>Yüksek</span>
            </div>
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
