import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle, Clock, Play, Pause, Lock, Unlock, ArrowRight, Plus, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/ui/Modal';

interface BudgetPeriod {
  id: string;
  organization_id: string;
  preparation_year: number;
  budget_year: number;
  period_status: string;
  preparation_start_date: string;
  preparation_end_date: string;
  approval_start_date: string;
  approval_deadline_date: string;
  execution_start_date: string;
  execution_end_date: string;
  closing_date: string;
  is_active: boolean;
  is_current: boolean;
  notes: string;
  created_at: string;
}

interface PeriodConstraints {
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  message: string;
  hint: string;
  period_status: string;
  budget_year: number;
  preparation_year: number;
  is_current: boolean;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  preparation: 'bg-blue-100 text-blue-700',
  approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  active: 'bg-purple-100 text-purple-700',
  executing: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  preparation: 'Hazırlık',
  approval: 'Onay Sürecinde',
  approved: 'Onaylandı',
  active: 'Aktif',
  executing: 'Yürütülüyor',
  closed: 'Kapalı',
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="w-5 h-5" />,
  preparation: <Unlock className="w-5 h-5" />,
  approval: <AlertCircle className="w-5 h-5" />,
  approved: <CheckCircle className="w-5 h-5" />,
  active: <Play className="w-5 h-5" />,
  executing: <Play className="w-5 h-5" />,
  closed: <Lock className="w-5 h-5" />,
};

export default function BudgetPeriodManagement() {
  const { user, profile } = useAuth();
  const [periods, setPeriods] = useState<BudgetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState<BudgetPeriod | null>(null);
  const [constraints, setConstraints] = useState<PeriodConstraints | null>(null);
  const [creating, setCreating] = useState(false);
  const [showManualStatusModal, setShowManualStatusModal] = useState(false);
  const [selectedPeriodForManualChange, setSelectedPeriodForManualChange] = useState<BudgetPeriod | null>(null);
  const [manualStatusValue, setManualStatusValue] = useState('');

  useEffect(() => {
    loadPeriods();
  }, [user, profile]);

  const loadPeriods = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: periodsData, error: periodsError } = await supabase
        .from('budget_periods')
        .select('*')
        .order('budget_year', { ascending: false });

      if (periodsError) throw periodsError;

      setPeriods(periodsData || []);

      const current = periodsData?.find(p => p.is_current);
      if (current) {
        setCurrentPeriod(current);
        await loadConstraints(current.id);
      }
    } catch (error) {
      console.error('Error loading periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConstraints = async (periodId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_period_constraints', {
        p_period_id: periodId,
      });

      if (error) throw error;
      setConstraints(data);
    } catch (error) {
      console.error('Error loading constraints:', error);
    }
  };

  const handleTransitionStatus = async (periodId: string, newStatus: string) => {
    try {
      const { data, error } = await supabase.rpc('transition_period_status', {
        p_period_id: periodId,
        p_new_status: newStatus,
        p_transition_type: 'manual',
        p_notes: `Status changed to ${newStatus}`,
      });

      if (error) throw error;

      alert(`Dönem durumu "${statusLabels[newStatus]}" olarak güncellendi`);
      await loadPeriods();
    } catch (error: any) {
      alert(`Hata: ${error.message}`);
    }
  };

  const handleStartNextYear = async () => {
    if (!profile?.organization_id) {
      alert('Organizasyon bilgisi bulunamadı');
      return;
    }

    if (!confirm('Yeni yıl bütçe hazırlığını başlatmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      setCreating(true);

      const { data, error } = await supabase.rpc('start_next_year_budget_preparation', {
        p_organization_id: profile.organization_id,
      });

      if (error) throw error;

      alert(
        `${data.new_budget_year} yılı bütçe hazırlığı başlatıldı!\n\n` +
        `Klonlanan veriler:\n` +
        `- ${data.clone_result.cloned_mappings} eşleştirme\n` +
        `- ${data.clone_result.cloned_justifications} gerekçe\n` +
        `- ${data.clone_result.cloned_budget_entries} bütçe girişi`
      );

      await loadPeriods();
    } catch (error: any) {
      alert(`Hata: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const transitions: Record<string, string> = {
      draft: 'preparation',
      preparation: 'approval',
      approval: 'approved',
      approved: 'active',
      active: 'executing',
      executing: 'closed',
    };
    return transitions[currentStatus] || null;
  };

  const handleOpenManualStatusModal = (period: BudgetPeriod) => {
    setSelectedPeriodForManualChange(period);
    setManualStatusValue(period.period_status);
    setShowManualStatusModal(true);
  };

  const handleManualStatusChange = async () => {
    if (!selectedPeriodForManualChange || !manualStatusValue) return;

    if (!confirm(`${selectedPeriodForManualChange.budget_year} yılı döneminin durumunu "${statusLabels[manualStatusValue]}" olarak değiştirmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('transition_period_status', {
        p_period_id: selectedPeriodForManualChange.id,
        p_new_status: manualStatusValue,
        p_transition_type: 'manual',
        p_notes: `Manuel durum değişikliği: ${selectedPeriodForManualChange.period_status} -> ${manualStatusValue}`,
      });

      if (error) throw error;

      alert(`Dönem durumu "${statusLabels[manualStatusValue]}" olarak güncellendi`);
      setShowManualStatusModal(false);
      await loadPeriods();
    } catch (error: any) {
      alert(`Hata: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bütçe Dönemi Yönetimi</h1>
          <p className="text-gray-600 mt-1">
            Bütçe hazırlık dönemlerini yönetin ve yaşam döngüsünü takip edin
          </p>
        </div>
        <button
          onClick={handleStartNextYear}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          Yeni Yıl Başlat
        </button>
      </div>

      {currentPeriod && constraints && (
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentPeriod.budget_year} Mali Yılı Bütçesi
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[currentPeriod.period_status]}`}>
                  {statusLabels[currentPeriod.period_status]}
                </span>
              </div>
              <p className="text-gray-600 mb-4">
                {currentPeriod.preparation_year} yılında hazırlanan {currentPeriod.budget_year} yılı bütçesi
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-medium text-blue-900 mb-1">{constraints.message}</p>
                <p className="text-sm text-blue-700">{constraints.hint}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Hazırlık Başlangıcı</p>
                  <p className="font-medium">{new Date(currentPeriod.preparation_start_date).toLocaleDateString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hazırlık Bitişi</p>
                  <p className="font-medium">{new Date(currentPeriod.preparation_end_date).toLocaleDateString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Onay Son Tarihi</p>
                  <p className="font-medium">{new Date(currentPeriod.approval_deadline_date).toLocaleDateString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Yürürlük Başlangıcı</p>
                  <p className="font-medium">{new Date(currentPeriod.execution_start_date).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${constraints.can_create ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">Veri Girişi</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${constraints.can_edit ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">Düzenleme</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${constraints.can_approve ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">Onaylama</span>
                </div>
              </div>
            </div>

            {getNextStatus(currentPeriod.period_status) && (
              <button
                onClick={() => handleTransitionStatus(currentPeriod.id, getNextStatus(currentPeriod.period_status)!)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <ArrowRight className="w-5 h-5" />
                {statusLabels[getNextStatus(currentPeriod.period_status)!]} Yap
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Tüm Dönemler</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bütçe Yılı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hazırlık Yılı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hazırlık Dönemi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yürürlük Dönemi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum Değiştir</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {periods.map((period) => (
                <tr key={period.id} className={period.is_current ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {statusIcons[period.period_status]}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[period.period_status]}`}>
                        {statusLabels[period.period_status]}
                      </span>
                      {period.is_current && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">Güncel</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{period.budget_year}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{period.preparation_year}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(period.preparation_start_date).toLocaleDateString('tr-TR')} -
                      {new Date(period.preparation_end_date).toLocaleDateString('tr-TR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(period.execution_start_date).toLocaleDateString('tr-TR')} -
                      {new Date(period.execution_end_date).toLocaleDateString('tr-TR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getNextStatus(period.period_status) && (
                        <button
                          onClick={() => handleTransitionStatus(period.id, getNextStatus(period.period_status)!)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          → {statusLabels[getNextStatus(period.period_status)!]}
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenManualStatusModal(period)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Manuel Durum Değiştir"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dönem Yaşam Döngüsü</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Taslak</h3>
              <p className="text-sm text-gray-600">Dönem oluşturuldu, henüz başlatılmadı</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Unlock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Hazırlık</h3>
              <p className="text-sm text-gray-600">Bütçe verileri giriliyor, düzenlemeler yapılıyor (Ekim-Kasım)</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Onay</h3>
              <p className="text-sm text-gray-600">3 aşamalı onay süreci (Müdür → Başkan Yardımcısı → Admin) (Aralık)</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Onaylandı</h3>
              <p className="text-sm text-gray-600">Tüm onaylar tamamlandı, TBMM onayı bekleniyor/alındı (Ocak)</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Play className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Aktif/Yürütülüyor</h3>
              <p className="text-sm text-gray-600">Bütçe yürürlüğe girdi, gerçekleşme takibi yapılıyor (1 Ocak - 31 Aralık)</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Kapalı</h3>
              <p className="text-sm text-gray-600">Dönem kapandı, sadece raporlama yapılabilir</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showManualStatusModal}
        onClose={() => setShowManualStatusModal(false)}
        title="Manuel Durum Değiştir"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800">
                  Bu özellik ile dönemi istediğiniz duruma manuel olarak geçirebilirsiniz.
                  Kapalı dönemleri tekrar açabilir veya herhangi bir duruma geçiş yapabilirsiniz.
                </p>
              </div>
            </div>
          </div>

          {selectedPeriodForManualChange && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Dönem:</span> {selectedPeriodForManualChange.budget_year} Mali Yılı
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Mevcut Durum:</span>{' '}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedPeriodForManualChange.period_status]}`}>
                    {statusLabels[selectedPeriodForManualChange.period_status]}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yeni Durum Seçin
                </label>
                <select
                  value={manualStatusValue}
                  onChange={(e) => setManualStatusValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="draft">Taslak</option>
                  <option value="preparation">Hazırlık</option>
                  <option value="approval">Onay Sürecinde</option>
                  <option value="approved">Onaylandı</option>
                  <option value="active">Aktif</option>
                  <option value="executing">Yürütülüyor</option>
                  <option value="closed">Kapalı</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowManualStatusModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  İptal
                </button>
                <button
                  onClick={handleManualStatusChange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Durumu Değiştir
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
