import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit2, Lock, Unlock, Calendar, Check } from 'lucide-react';

interface FiscalYear {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: 'open' | 'closed' | 'archived';
  created_at: string;
}

export default function FiscalYearManagement() {
  const { profile } = useAuth();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    is_current: false
  });

  useEffect(() => {
    if (profile) {
      loadFiscalYears();
    }
  }, [profile]);

  const loadFiscalYears = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('year', { ascending: false });

      if (error) throw error;
      if (data) setFiscalYears(data);
    } catch (error) {
      console.error('Error loading fiscal years:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const { error } = await supabase.from('fiscal_years').insert({
        organization_id: profile.organization_id,
        year: formData.year,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_current: formData.is_current,
        status: 'open'
      });

      if (error) throw error;

      setShowModal(false);
      loadFiscalYears();
      resetForm();
    } catch (error) {
      console.error('Error creating fiscal year:', error);
      alert('Mali yıl oluşturma hatası');
    }
  };

  const setAsCurrent = async (id: string) => {
    if (!profile) return;

    try {
      await supabase
        .from('fiscal_years')
        .update({ is_current: false })
        .eq('organization_id', profile.organization_id);

      await supabase
        .from('fiscal_years')
        .update({ is_current: true })
        .eq('id', id);

      loadFiscalYears();
    } catch (error) {
      console.error('Error setting current year:', error);
    }
  };

  const changeStatus = async (id: string, status: 'open' | 'closed' | 'archived') => {
    try {
      await supabase
        .from('fiscal_years')
        .update({ status })
        .eq('id', id);

      loadFiscalYears();
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const resetForm = () => {
    const currentYear = new Date().getFullYear();
    setFormData({
      year: currentYear,
      start_date: `${currentYear}-01-01`,
      end_date: `${currentYear}-12-31`,
      is_current: false
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mali Yıl Yönetimi</h1>
          <p className="text-gray-600 mt-1">Mali yılları tanımlayın ve yönetin</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Mali Yıl
        </Button>
      </div>

      <div className="grid gap-4">
        {fiscalYears.map((fy) => (
          <Card key={fy.id}>
            <CardBody>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{fy.year} Mali Yılı</h3>
                      {fy.is_current && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          <Check className="w-3 h-3 inline mr-1" />
                          Aktif
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        fy.status === 'open' ? 'bg-green-100 text-green-800' :
                        fy.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {fy.status === 'open' ? 'Açık' : fy.status === 'closed' ? 'Kapalı' : 'Arşivlendi'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(fy.start_date).toLocaleDateString('tr-TR')} - {new Date(fy.end_date).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!fy.is_current && fy.status === 'open' && (
                    <Button variant="outline" size="sm" onClick={() => setAsCurrent(fy.id)}>
                      Aktif Yap
                    </Button>
                  )}

                  {fy.status === 'open' && (
                    <Button variant="ghost" size="sm" onClick={() => changeStatus(fy.id, 'closed')}>
                      <Lock className="w-4 h-4 mr-1" />
                      Kapat
                    </Button>
                  )}

                  {fy.status === 'closed' && (
                    <Button variant="ghost" size="sm" onClick={() => changeStatus(fy.id, 'open')}>
                      <Unlock className="w-4 h-4 mr-1" />
                      Aç
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="Yeni Mali Yıl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mali Yıl <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_current"
              checked={formData.is_current}
              onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_current" className="ml-2 text-sm text-gray-700">
              Aktif mali yıl olarak ayarla
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
              İptal
            </Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
