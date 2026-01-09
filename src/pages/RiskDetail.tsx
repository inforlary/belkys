import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Info, BarChart3, Shield, Activity, TrendingUp } from 'lucide-react';

export default function RiskDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const riskId = currentPath.split('/').pop() || '';
  const [activeTab, setActiveTab] = useState('general');
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (riskId && profile?.organization_id) {
      loadRisk();
    }
  }, [riskId, profile?.organization_id]);

  const loadRisk = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('risk_register')
        .select(`
          *,
          risk_categories(category_name),
          departments(name),
          goals(goal_text)
        `)
        .eq('id', riskId)
        .single();

      if (error) throw error;
      setRisk(data);
    } catch (error) {
      console.error('Error loading risk:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'Genel Bilgiler', icon: Info },
    { id: 'assessment', label: 'Değerlendirme', icon: BarChart3 },
    { id: 'controls', label: 'Kontroller', icon: Shield },
    { id: 'treatments', label: 'Faaliyetler', icon: Activity },
    { id: 'indicators', label: 'Göstergeler', icon: TrendingUp }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Risk bulunamadı</div>
      </div>
    );
  }

  const inherentScore = (risk.inherent_likelihood || 0) * (risk.inherent_impact || 0);
  const residualScore = (risk.residual_likelihood || 0) * (risk.residual_impact || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/risk-management/risks')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{risk.code} - {risk.risk_name}</h1>
            <p className="text-gray-600 mt-1">{risk.risk_categories?.category_name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Kodu</label>
                <div className="text-gray-900">{risk.code}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Adı</label>
                <div className="text-gray-900">{risk.risk_name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <div className="text-gray-900">{risk.description || 'Belirtilmemiş'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <div className="text-gray-900">{risk.risk_categories?.category_name || 'Belirtilmemiş'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Birim</label>
                <div className="text-gray-900">{risk.departments?.name || 'Belirtilmemiş'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İlişkili Hedef</label>
                <div className="text-gray-900">{risk.goals?.goal_text || 'Belirtilmemiş'}</div>
              </div>
            </div>
          )}

          {activeTab === 'assessment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Doğal Risk</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Olasılık:</span>
                      <span className="ml-2 font-medium">{risk.inherent_likelihood || 0}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Etki:</span>
                      <span className="ml-2 font-medium">{risk.inherent_impact || 0}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Skor:</span>
                      <span className="ml-2 text-2xl font-bold text-red-600">{inherentScore}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Artık Risk</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Olasılık:</span>
                      <span className="ml-2 font-medium">{risk.residual_likelihood || 0}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Etki:</span>
                      <span className="ml-2 font-medium">{risk.residual_impact || 0}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Skor:</span>
                      <span className="ml-2 text-2xl font-bold text-orange-600">{residualScore}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="text-center py-8 text-gray-500">
              Mevcut kontroller listesi burada görüntülenecek
            </div>
          )}

          {activeTab === 'treatments' && (
            <div className="text-center py-8 text-gray-500">
              Risk azaltma faaliyetleri burada görüntülenecek
            </div>
          )}

          {activeTab === 'indicators' && (
            <div className="text-center py-8 text-gray-500">
              Bu riske bağlı göstergeler burada görüntülenecek
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
