import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

interface PeriodLock {
  id: string;
  period_type: 'month' | 'quarter' | 'year';
  period_year: number;
  period_number: number;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  locked_reason: string | null;
  locked_by_profile?: { full_name: string };
}

interface FiscalYear {
  id: string;
  year: number;
}

export default function PeriodLockManagement() {
  const { profile } = useAuth();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('');
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodLock | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [loading, setLoading] = useState(true);

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  useEffect(() => {
    if (profile) {
      loadFiscalYears();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedFiscalYear) {
      loadPeriodLocks();
    }
  }, [selectedFiscalYear]);

  const loadFiscalYears = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('fiscal_years')
        .select('id, year')
        .eq('organization_id', profile.organization_id)
        .order('year', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setFiscalYears(data);
        const current = data.find((fy: any) => fy.is_current);
        setSelectedFiscalYear(current?.id || data[0].id);
      }
    } catch (error) {
      console.error('Error loading fiscal years:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPeriodLocks = async () => {
    if (!profile || !selectedFiscalYear) return;

    try {
      const selectedYear = fiscalYears.find(fy => fy.id === selectedFiscalYear);
      if (!selectedYear) return;

      const { data, error } = await supabase
        .from('period_locks')
        .select('*, locked_by_profile:profiles!period_locks_locked_by_fkey(full_name)')
        .eq('organization_id', profile.organization_id)
        .eq('fiscal_year_id', selectedFiscalYear)
        .eq('period_type', 'month')
        .eq('period_year', selectedYear.year)
        .order('period_number');

      if (error) throw error;

      if (data) {
        setPeriodLocks(data);
      } else {
        await initializePeriodLocks(selectedYear.year);
      }
    } catch (error) {
      console.error('Error loading period locks:', error);
    }
  };

  const initializePeriodLocks = async (year: number) => {
    if (!profile || !selectedFiscalYear) return;

    try {
      const locks = Array.from({ length: 12 }, (_, i) => ({
        organization_id: profile.organization_id,
        fiscal_year_id: selectedFiscalYear,
        period_type: 'month' as const,
        period_year: year,
        period_number: i + 1,
        is_locked: false
      }));

      const { error } = await supabase.from('period_locks').insert(locks);
      if (error) throw error;

      loadPeriodLocks();
    } catch (error) {
      console.error('Error initializing period locks:', error);
    }
  };

  const toggleLock = async (period: PeriodLock) => {
    setSelectedPeriod(period);
    setShowModal(true);
  };

  const handleLockToggle = async () => {
    if (!profile || !selectedPeriod) return;

    try {
      const newLockedState = !selectedPeriod.is_locked;

      const updateData: any = {
        is_locked: newLockedState,
        locked_by: newLockedState ? profile.id : null,
        locked_at: newLockedState ? new Date().toISOString() : null,
        locked_reason: newLockedState ? lockReason : null
      };

      const { error } = await supabase
        .from('period_locks')
        .update(updateData)
        .eq('id', selectedPeriod.id);

      if (error) throw error;

      setShowModal(false);
      setLockReason('');
      loadPeriodLocks();
    } catch (error) {
      console.error('Error toggling lock:', error);
      alert('İşlem başarısız');
    }
  };

  const bulkLock = async (lockUntilMonth: number) => {
    if (!profile || !confirm(`${months[lockUntilMonth - 1]} ayı dahil önceki tüm aylar kilitlenecek. Emin misiniz?`)) return;

    try {
      const periodsToLock = periodLocks.filter(p => p.period_number <= lockUntilMonth && !p.is_locked);

      for (const period of periodsToLock) {
        await supabase
          .from('period_locks')
          .update({
            is_locked: true,
            locked_by: profile.id,
            locked_at: new Date().toISOString(),
            locked_reason: 'Toplu kilit işlemi'
          })
          .eq('id', period.id);
      }

      loadPeriodLocks();
    } catch (error) {
      console.error('Error bulk locking:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dönem Kilidi Yönetimi</h1>
        <p className="text-gray-600 mt-1">Aylık dönemleri kilitleyin ve açın</p>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mali Yıl Seçin
              </label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>{fy.year}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-end">
              {[3, 6, 9, 12].map((month) => (
                <Button
                  key={month}
                  variant="outline"
                  size="sm"
                  onClick={() => bulkLock(month)}
                >
                  {months[month - 1]}'a Kadar Kilitle
                </Button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {periodLocks.map((period) => (
          <Card key={period.id}>
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{months[period.period_number - 1]} {period.period_year}</h3>
                  {period.is_locked ? (
                    <Lock className="w-4 h-4 text-red-600" />
                  ) : (
                    <Unlock className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  period.is_locked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {period.is_locked ? 'Kilitli' : 'Açık'}
                </span>
              </div>

              {period.is_locked && (
                <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
                  <div className="text-gray-600">Kilitleyen: {period.locked_by_profile?.full_name || 'Bilinmiyor'}</div>
                  <div className="text-gray-600">Tarih: {period.locked_at ? new Date(period.locked_at).toLocaleDateString('tr-TR') : '-'}</div>
                  {period.locked_reason && (
                    <div className="text-gray-600 mt-1">Sebep: {period.locked_reason}</div>
                  )}
                </div>
              )}

              <Button
                variant={period.is_locked ? 'outline' : 'primary'}
                size="sm"
                onClick={() => toggleLock(period)}
                className="w-full"
              >
                {period.is_locked ? (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Kilidi Aç
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Kilitle
                  </>
                )}
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setLockReason(''); }}
        title={selectedPeriod?.is_locked ? 'Dönem Kilidini Aç' : 'Dönemi Kilitle'}
      >
        <div className="space-y-4">
          {selectedPeriod && (
            <>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  {selectedPeriod.is_locked ? (
                    <p>
                      <strong>{months[selectedPeriod.period_number - 1]} {selectedPeriod.period_year}</strong> dönemi kilitli.
                      Kilidi açarsanız bu döneme ait kayıtlar düzenlenebilir hale gelecektir.
                    </p>
                  ) : (
                    <p>
                      <strong>{months[selectedPeriod.period_number - 1]} {selectedPeriod.period_year}</strong> dönemi kilitlenecek.
                      Kilitli dönemler sadece <strong>düzeltme fişi</strong> ile düzenlenebilir.
                    </p>
                  )}
                </div>
              </div>

              {!selectedPeriod.is_locked && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kilitleme Sebebi
                  </label>
                  <textarea
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Neden kilitliyorsunuz? (isteğe bağlı)"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowModal(false); setLockReason(''); }}>
                  İptal
                </Button>
                <Button onClick={handleLockToggle}>
                  {selectedPeriod.is_locked ? 'Kilidi Aç' : 'Kilitle'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
