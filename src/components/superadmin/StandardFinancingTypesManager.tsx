import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, DollarSign, X, Save, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface FinancingType {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export default function StandardFinancingTypesManager() {
  const [financingTypes, setFinancingTypes] = useState<FinancingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancingType | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadFinancingTypes();
  }, []);

  const loadFinancingTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financing_types')
        .select('*')
        .is('organization_id', null)
        .order('code');

      if (error) throw error;
      setFinancingTypes(data || []);
    } catch (error) {
      console.error('Finansman tipleri yüklenirken hata:', error);
      alert('Finansman tipleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (item: FinancingType) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      description: item.description || '',
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('Kod ve isim alanları zorunludur');
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('financing_types')
          .update({
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('financing_types')
          .insert({
            organization_id: null,
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
          });

        if (error) throw error;
      }

      setShowModal(false);
      loadFinancingTypes();
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Kayıt başarısız: ' + (error.message || ''));
    }
  };

  const handleDelete = async (item: FinancingType) => {
    if (!confirm(`"${item.name}" finansman tipini silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('financing_types')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      loadFinancingTypes();
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + (error.message || ''));
    }
  };

  const handleImportPaste = async () => {
    if (!pastedData.trim()) {
      alert('Lütfen veri yapıştırın!');
      return;
    }

    try {
      setImporting(true);
      const lines = pastedData.trim().split('\n');

      let successCount = 0;
      let errorCount = 0;

      for (const line of lines) {
        try {
          const columns = line.split('\t');

          if (columns.length < 2) {
            errorCount++;
            continue;
          }

          const code = columns[0] ? columns[0].trim() : '';
          const name = columns[1] ? columns[1].trim() : '';
          const description = columns[2] ? columns[2].trim() : '';

          if (!code || !name) {
            errorCount++;
            continue;
          }

          const { error } = await supabase
            .from('financing_types')
            .insert({
              organization_id: null,
              code,
              name,
              description: description || null,
              is_active: true,
            });

          if (error) {
            console.error('Kayıt hatası:', error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error('Satır işleme hatası:', err);
          errorCount++;
        }
      }

      alert(`İçe aktarma tamamlandı!\nBaşarılı: ${successCount}\nHatalı: ${errorCount}`);
      setShowImportModal(false);
      setPastedData('');
      loadFinancingTypes();
    } catch (error: any) {
      console.error('Veri işleme hatası:', error);
      alert('Veri işlenemedi: ' + (error.message || ''));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Standart Finansman Tipleri</h3>
          <p className="text-sm text-gray-600 mt-1">
            Tüm belediyeler için geçerli olan finansman tipi kodları
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowImportModal(true)}
            variant="outline"
            className="flex items-center gap-2 border-green-500 text-green-700 hover:bg-green-50"
          >
            <Upload className="w-4 h-4" />
            Excel'den Yapıştır
          </Button>
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yeni Finansman Tipi Ekle
          </Button>
        </div>
      </div>

      {financingTypes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600 font-medium">Henüz finansman tipi eklenmemiş</p>
          <Button onClick={handleAdd} className="mt-4 flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" />
            İlk Finansman Tipini Ekle
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kod
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İsim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Açıklama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {financingTypes.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-medium text-gray-900">{item.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{item.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{item.description || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.is_active ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Aktif
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                      title="Düzenle"
                    >
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-red-600 hover:text-red-800"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingItem ? 'Finansman Tipi Düzenle' : 'Yeni Finansman Tipi Ekle'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kod <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: 1, 2, 3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İsim <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: Genel Bütçe"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Detaylı açıklama..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Aktif
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setPastedData('');
          }}
          title="Excel'den Veri Yapıştır"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">Nasıl Kullanılır:</p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Excel dosyanızı açın</li>
                <li>Verileri seçin (başlık satırı olmadan)</li>
                <li>Kopyalayın (Ctrl+C veya Cmd+C)</li>
                <li>Aşağıdaki alana yapıştırın (Ctrl+V veya Cmd+V)</li>
              </ol>
              <p className="text-xs text-blue-600 mt-2">
                Format: Kod | İsim | Açıklama
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel Verisi
              </label>
              <textarea
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Excel'den kopyaladığınız veriyi buraya yapıştırın..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {pastedData.trim() ? `${pastedData.trim().split('\n').length} satır` : 'Veri bekleniyor...'}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setPastedData('');
                }}
              >
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleImportPaste} disabled={importing || !pastedData.trim()}>
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
