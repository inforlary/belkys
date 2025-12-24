import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Lock, Unlock, Bell } from 'lucide-react';

interface Indicator {
  id: string;
  code: string;
  name: string;
  measurement_frequency: string;
  goal?: {
    code: string;
    title: string;
    department?: {
      name: string;
    };
  };
}

interface QuarterActivation {
  id: string;
  indicator_id: string;
  year: number;
  quarter: number;
  is_active: boolean;
}

export default function QuarterActivation() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [activations, setActivations] = useState<QuarterActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [updating, setUpdating] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const getPeriods = (frequency: string) => {
    if (frequency === 'monthly') {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } else if (frequency === 'quarterly' || frequency === '3-month') {
      return [1, 2, 3, 4];
    } else if (frequency === 'semi-annual' || frequency === 'semi_annual' || frequency === '6-month') {
      return [1, 2]; // H1 and H2
    } else if (frequency === 'annual' || frequency === 'yearly') {
      return [1]; // Annual
    }
    return [1, 2, 3, 4]; // Default to quarterly
  };

  const getPeriodLabel = (frequency: string, period: number) => {
    if (frequency === 'monthly') {
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return monthNames[period - 1] || `Ay ${period}`;
    } else if (frequency === 'quarterly' || frequency === '3-month') {
      return `Ç${period}`;
    } else if (frequency === 'semi-annual' || frequency === 'semi_annual' || frequency === '6-month') {
      return period === 1 ? 'Y1' : 'Y2';
    } else if (frequency === 'annual' || frequency === 'yearly') {
      return 'Yıllık';
    }
    return `Ç${period}`;
  };

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadData();
    }
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const [indicatorsRes, activationsRes] = await Promise.all([
        supabase
          .from('indicators')
          .select(`
            *,
            goals!inner(
              code,
              title,
              departments(name)
            )
          `)
          .eq('organization_id', profile.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('quarter_activations')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('year', selectedYear)
      ]);

      if (indicatorsRes.error) throw indicatorsRes.error;
      if (activationsRes.error) throw activationsRes.error;

      setIndicators(indicatorsRes.data?.map(ind => ({
        ...ind,
        goal: {
          code: ind.goals.code,
          title: ind.goals.title,
          department: ind.goals.departments
        }
      })) || []);

      setActivations(activationsRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const isQuarterActive = (indicatorId: string, quarter: number) => {
    const activation = activations.find(
      a => a.indicator_id === indicatorId && a.quarter === quarter
    );
    return activation?.is_active || false;
  };

  const toggleQuarter = async (indicatorId: string, quarter: number) => {
    if (!profile?.organization_id) return;

    setUpdating(true);
    try {
      const existingActivation = activations.find(
        a => a.indicator_id === indicatorId && a.quarter === quarter
      );

      if (existingActivation) {
        const { error } = await supabase
          .from('quarter_activations')
          .update({
            is_active: !existingActivation.is_active,
            activated_at: !existingActivation.is_active ? new Date().toISOString() : null,
            activated_by: !existingActivation.is_active ? profile.id : null
          })
          .eq('id', existingActivation.id);

        if (error) throw error;

        if (!existingActivation.is_active) {
          await createNotification(indicatorId, quarter);
        }
      } else {
        const { error } = await supabase
          .from('quarter_activations')
          .insert({
            organization_id: profile.organization_id,
            indicator_id: indicatorId,
            year: selectedYear,
            quarter: quarter,
            is_active: true,
            activated_at: new Date().toISOString(),
            activated_by: profile.id
          });

        if (error) throw error;
        await createNotification(indicatorId, quarter);
      }

      await loadData();
    } catch (error: any) {
      console.error('Güncelleme hatası:', error);
      alert(error.message || 'Güncelleme başarısız');
    } finally {
      setUpdating(false);
    }
  };

  const createNotification = async (indicatorId: string, quarter: number) => {
    if (!profile?.organization_id) return;

    try {
      const indicator = indicators.find(i => i.id === indicatorId);
      if (!indicator) return;

      const { data: goalData } = await supabase
        .from('goals')
        .select('department_id')
        .eq('id', (indicator as any).goal_id)
        .single();

      if (goalData) {
        await supabase
          .from('quarter_notifications')
          .insert({
            organization_id: profile.organization_id,
            department_id: goalData.department_id,
            year: selectedYear,
            quarter: quarter,
            message: `📢 Yeni periyot verisi girişi aktif hale getirildi: ${selectedYear} - Ç${quarter}`
          });
      }
    } catch (error) {
      console.error('Bildirim oluşturma hatası:', error);
    }
  };

  const activateAllQuarters = async (indicatorId: string, frequency: string) => {
    const periods = getPeriods(frequency);
    const allActive = periods.every(period => isQuarterActive(indicatorId, period));
    const action = allActive ? 'kilitlemek' : 'açmak';

    if (!confirm(`Bu gösterge için tüm periyotları ${action} istediğinizden emin misiniz?`)) {
      return;
    }

    setUpdating(true);
    try {
      for (const period of periods) {
        const isActive = isQuarterActive(indicatorId, period);
        if (allActive ? isActive : !isActive) {
          await toggleQuarter(indicatorId, period);
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  const activateQuarterForAll = async (quarter: number) => {
    const relevantIndicators = indicators.filter(indicator =>
      getPeriods(indicator.measurement_frequency).includes(quarter)
    );
    const allActive = relevantIndicators.every(indicator =>
      isQuarterActive(indicator.id, quarter)
    );
    const action = allActive ? 'kilitlemek' : 'açmak';

    if (!confirm(`Tüm göstergeler için ${getPeriodLabel('quarterly', quarter)} periyodunu ${action} istediğinizden emin misiniz?`)) {
      return;
    }

    setUpdating(true);
    try {
      for (const indicator of relevantIndicators) {
        const isActive = isQuarterActive(indicator.id, quarter);
        if (allActive ? isActive : !isActive) {
          await toggleQuarter(indicator.id, quarter);
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardBody>
            <p className="text-slate-600 text-center">
              Bu sayfaya erişim yetkiniz yok.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  const maxPeriods = Math.max(...indicators.map(ind => getPeriods(ind.measurement_frequency).length), 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Çeyrek Aktivasyon Kontrolü</h1>
          <p className="text-slate-600 mt-1">
            Performans göstergeleri için periyot bazlı veri girişlerini yönetin (aylık, çeyreklik, 6 aylık, yıllık)
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Yıl Seçin
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gösterge Çeyrek Durumları</h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-green-600" />
                <span className="text-slate-600">Açık</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Kilitli</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider" rowSpan={2}>
                    Gösterge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider" rowSpan={2}>
                    Müdürlük
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider" rowSpan={2}>
                    Ölçüm Sıklığı
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider" colSpan={maxPeriods}>
                    Periyotlar
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider" rowSpan={2}>
                    İşlemler
                  </th>
                </tr>
                <tr>
                  {Array.from({ length: maxPeriods }).map((_, idx) => (
                    <th key={idx} className="px-2 py-2 text-center border-l border-slate-200">
                      <span className="text-xs text-slate-500">Periyot {idx + 1}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {indicators.map((indicator) => {
                  const periods = getPeriods(indicator.measurement_frequency);
                  console.log(`[Çeyrek Aktivasyon] ${indicator.code}: measurement_frequency="${indicator.measurement_frequency}", periods=`, periods);
                  const frequencyLabel = indicator.measurement_frequency === 'monthly' ? 'Aylık' :
                    indicator.measurement_frequency === 'quarterly' || indicator.measurement_frequency === '3-month' ? '3 Aylık' :
                    indicator.measurement_frequency === 'semi-annual' || indicator.measurement_frequency === 'semi_annual' || indicator.measurement_frequency === '6-month' ? '6 Aylık' :
                    indicator.measurement_frequency === 'annual' || indicator.measurement_frequency === 'yearly' ? 'Yıllık' : indicator.measurement_frequency;

                  return (
                    <tr key={indicator.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{indicator.code}</div>
                        <div className="text-sm text-slate-600">{indicator.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {indicator.goal?.department?.name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-medium text-slate-600">{frequencyLabel}</span>
                      </td>
                      {periods.map(period => {
                        const isActive = isQuarterActive(indicator.id, period);
                        return (
                          <td key={period} className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-medium text-slate-600">{getPeriodLabel(indicator.measurement_frequency, period)}</span>
                              <button
                                onClick={() => toggleQuarter(indicator.id, period)}
                                disabled={updating}
                                className={`p-2 rounded-lg transition-colors ${
                                  isActive
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                                title={isActive ? 'Kilitle' : 'Aç'}
                              >
                                {isActive ? (
                                  <Unlock className="w-5 h-5" />
                                ) : (
                                  <Lock className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      {/* Fill empty cells for indicators with fewer periods */}
                      {Array.from({ length: maxPeriods - periods.length }).map((_, idx) => (
                        <td key={`empty-${idx}`} className="px-6 py-4 text-center bg-slate-50"></td>
                      ))}
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const periods = getPeriods(indicator.measurement_frequency);
                          const allActive = periods.every(period => isQuarterActive(indicator.id, period));
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateAllQuarters(indicator.id, indicator.measurement_frequency)}
                              disabled={updating}
                            >
                              {allActive ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
                              {allActive ? 'Kitle' : 'Aç'}
                            </Button>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold text-slate-900 mb-2">ℹ️ Bilgilendirme</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Müdürlük kullanıcıları yalnızca açık periyotlara veri girebilir</li>
            <li>• Bir periyot açıldığında ilgili müdürlüğe bildirim gönderilir</li>
            <li>• Periyotlar göstergenin ölçüm sıklığına göre değişir (aylık, çeyreklik, 6 aylık, yıllık)</li>
            <li>• Kilitli periyotlar veri girişi için devre dışıdır</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
