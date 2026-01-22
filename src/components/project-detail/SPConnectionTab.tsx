import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Target, Plus, X, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';

interface Project {
  id: string;
  related_objective_id?: string;
  related_goal_id?: string;
  related_indicator_id?: string;
}

interface Objective {
  id: string;
  code: string;
  name: string;
}

interface Goal {
  id: string;
  code: string;
  name: string;
  objective_id: string;
}

interface Indicator {
  id: string;
  code: string;
  name: string;
  goal_id: string;
}

interface SPConnectionTabProps {
  project: Project;
  onUpdate: () => void;
}

export default function SPConnectionTab({ project, onUpdate }: SPConnectionTabProps) {
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  const [selectedObjective, setSelectedObjective] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedIndicator, setSelectedIndicator] = useState('');

  const [currentConnection, setCurrentConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadObjectives();
      loadCurrentConnection();
    }
  }, [profile?.organization_id, project.id]);

  useEffect(() => {
    if (selectedObjective) {
      loadGoals(selectedObjective);
      setSelectedGoal('');
      setSelectedIndicator('');
    }
  }, [selectedObjective]);

  useEffect(() => {
    if (selectedGoal) {
      loadIndicators(selectedGoal);
      setSelectedIndicator('');
    }
  }, [selectedGoal]);

  const loadObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('id, code, name')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setObjectives(data || []);
    } catch (error) {
      console.error('Amaçlar yüklenirken hata:', error);
    }
  };

  const loadGoals = async (objectiveId: string) => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, code, name, objective_id')
        .eq('objective_id', objectiveId)
        .order('code');

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Hedefler yüklenirken hata:', error);
    }
  };

  const loadIndicators = async (goalId: string) => {
    try {
      const { data, error } = await supabase
        .from('indicators')
        .select('id, code, name, goal_id')
        .eq('goal_id', goalId)
        .order('code');

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
    }
  };

  const loadCurrentConnection = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          related_objective_id,
          related_goal_id,
          related_indicator_id,
          objective:objectives!related_objective_id(id, code, name),
          goal:goals!related_goal_id(id, code, name),
          indicator:indicators!related_indicator_id(id, code, name)
        `)
        .eq('id', project.id)
        .single();

      if (error) throw error;
      if (data?.related_objective_id) {
        setCurrentConnection(data);
      }
    } catch (error) {
      console.error('Bağlantı yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedObjective || !selectedGoal || !selectedIndicator) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('projects')
        .update({
          related_objective_id: selectedObjective,
          related_goal_id: selectedGoal,
          related_indicator_id: selectedIndicator,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      alert('Stratejik plan bağlantısı başarıyla kaydedildi');
      setShowModal(false);
      loadCurrentConnection();
      onUpdate();
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      alert('Bağlantı kaydedilirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConnection = async () => {
    if (!confirm('Stratejik plan bağlantısını kaldırmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          related_objective_id: null,
          related_goal_id: null,
          related_indicator_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      alert('Bağlantı kaldırıldı');
      setCurrentConnection(null);
      onUpdate();
    } catch (error) {
      console.error('Bağlantı kaldırma hatası:', error);
      alert('Bir hata oluştu');
    }
  };

  const openModal = () => {
    setSelectedObjective(currentConnection?.related_objective_id || '');
    setSelectedGoal(currentConnection?.related_goal_id || '');
    setSelectedIndicator(currentConnection?.related_indicator_id || '');
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      {currentConnection?.related_objective_id ? (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  Stratejik Plan Bağlantısı
                </h3>
                <div className="space-y-2">
                  {currentConnection.objective && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Amaç:</span>
                      <span className="ml-2 text-gray-900">
                        {currentConnection.objective.code} - {currentConnection.objective.name}
                      </span>
                    </div>
                  )}
                  {currentConnection.goal && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Hedef:</span>
                      <span className="ml-2 text-gray-900">
                        {currentConnection.goal.code} - {currentConnection.goal.name}
                      </span>
                    </div>
                  )}
                  {currentConnection.indicator && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Gösterge:</span>
                      <span className="ml-2 text-gray-900">
                        {currentConnection.indicator.code} - {currentConnection.indicator.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openModal}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                Düzenle
              </button>
              <button
                onClick={handleRemoveConnection}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Bağlantıyı Kaldır"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-4">Henüz stratejik plan bağlantısı yapılmamış</p>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition mx-auto"
          >
            <Plus className="w-5 h-5" />
            SP Bağlantısı Ekle
          </button>
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Stratejik Plan Bağlantısı"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adım 1 - Stratejik Amaç Seçin
              </label>
              <select
                value={selectedObjective}
                onChange={(e) => setSelectedObjective(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Amaç seçin...</option>
                {objectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.code} - {obj.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adım 2 - Hedef Seçin
              </label>
              <select
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value)}
                disabled={!selectedObjective}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Hedef seçin...</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.code} - {goal.name}
                  </option>
                ))}
              </select>
              {!selectedObjective && (
                <p className="mt-1 text-xs text-gray-500">Önce amaç seçmelisiniz</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adım 3 - Performans Göstergesi Seçin
              </label>
              <select
                value={selectedIndicator}
                onChange={(e) => setSelectedIndicator(e.target.value)}
                disabled={!selectedGoal}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Gösterge seçin...</option>
                {indicators.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.code} - {ind.name}
                  </option>
                ))}
              </select>
              {!selectedGoal && (
                <p className="mt-1 text-xs text-gray-500">Önce hedef seçmelisiniz</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={saving}
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedObjective || !selectedGoal || !selectedIndicator || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {saving ? 'Kaydediliyor...' : 'Bağlantıyı Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
