import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  description: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: string;
  allow_over_limit: boolean;
  require_indicator_link: boolean;
  require_justification: boolean;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-800', icon: Clock },
  active: { label: 'Aktif', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  review: { label: 'İnceleme', color: 'bg-blue-100 text-blue-800', icon: Clock },
  approval: { label: 'Onay', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  completed: { label: 'Tamamlandı', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  cancelled: { label: 'İptal', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function BudgetCampaigns() {
  const { user, profile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fiscal_year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    status: 'draft',
    allow_over_limit: false,
    require_indicator_link: true,
    require_justification: true,
  });

  useEffect(() => {
    if (user && profile) {
      loadCampaigns();
    }
  }, [user, profile]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('budget_proposal_campaigns')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('fiscal_year', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      alert('Kampanyalar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  function openModal(campaign?: Campaign) {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        fiscal_year: campaign.fiscal_year,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        status: campaign.status,
        allow_over_limit: campaign.allow_over_limit,
        require_indicator_link: campaign.require_indicator_link,
        require_justification: campaign.require_justification,
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        fiscal_year: new Date().getFullYear(),
        start_date: '',
        end_date: '',
        status: 'draft',
        allow_over_limit: false,
        require_indicator_link: true,
        require_justification: true,
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCampaign(null);
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingCampaign) {
        const { error } = await supabase
          .from('budget_proposal_campaigns')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCampaign.id);

        if (error) throw error;
        alert('Kampanya güncellendi');
      } else {
        const { error } = await supabase
          .from('budget_proposal_campaigns')
          .insert({
            ...formData,
            organization_id: profile.organization_id,
            created_by: user.id,
          });

        if (error) throw error;
        alert('Kampanya oluşturuldu');
      }

      closeModal();
      loadCampaigns();
    } catch (error) {
      console.error('Error saving campaign:', error);
      alert('Kampanya kaydedilirken hata oluştu');
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Bu kampanyayı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('budget_proposal_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Kampanya silindi');
      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Kampanya silinirken hata oluştu');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bütçe Kampanyaları</h1>
          <p className="mt-1 text-sm text-gray-600">
            Bütçe hazırlık kampanyalarını yönetin
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Yeni Kampanya
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kampanya
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mali Yıl
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tarih Aralığı
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ayarlar
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.map((campaign) => {
              const statusInfo = statusConfig[campaign.status] || statusConfig.draft;
              const StatusIcon = statusInfo.icon;

              return (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                    {campaign.description && (
                      <div className="text-sm text-gray-500">{campaign.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {campaign.fiscal_year}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(campaign.start_date).toLocaleDateString('tr-TR')}
                    {' - '}
                    {new Date(campaign.end_date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-600 space-y-1">
                      {campaign.require_indicator_link && (
                        <div>✓ Gösterge zorunlu</div>
                      )}
                      {campaign.require_justification && (
                        <div>✓ Gerekçe zorunlu</div>
                      )}
                      {campaign.allow_over_limit && (
                        <div>⚠ Limit aşımı izinli</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => openModal(campaign)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => deleteCampaign(campaign.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Henüz Kampanya Yok</h3>
            <p className="mt-1 text-sm text-gray-500">
              Yeni bir bütçe kampanyası oluşturarak başlayın
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={saveCampaign}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingCampaign ? 'Kampanya Düzenle' : 'Yeni Kampanya'}
                </h2>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kampanya Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mali Yıl <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.fiscal_year}
                      onChange={(e) => setFormData({ ...formData, fiscal_year: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Başlangıç <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bitiş <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durum <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="draft">Taslak</option>
                    <option value="active">Aktif</option>
                    <option value="review">İnceleme</option>
                    <option value="approval">Onay</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="cancelled">İptal</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.require_indicator_link}
                      onChange={(e) => setFormData({ ...formData, require_indicator_link: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Gösterge bağlantısı zorunlu
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.require_justification}
                      onChange={(e) => setFormData({ ...formData, require_justification: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Gerekçe zorunlu
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.allow_over_limit}
                      onChange={(e) => setFormData({ ...formData, allow_over_limit: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Bütçe limiti aşımına izin ver
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCampaign ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
