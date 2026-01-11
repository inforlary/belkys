import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface ICComponent {
  id: string;
  code: string;
  name: string;
  order_index: number;
  created_at: string;
}

export default function ICComponentsManager() {
  const [components, setComponents] = useState<ICComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ICComponent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    order_index: 0,
  });

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ic_components')
        .select('*')
        .is('organization_id', null)
        .order('order_index');

      if (error) throw error;

      setComponents(data || []);
    } catch (error) {
      console.error('İç kontrol bileşenleri yüklenirken hata:', error);
      alert('İç kontrol bileşenleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      code: '',
      name: '',
      order_index: components.length > 0 ? Math.max(...components.map(c => c.order_index)) + 1 : 1,
    });
    setShowModal(true);
  };

  const handleEdit = (item: ICComponent) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      order_index: item.order_index,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('Lütfen kod ve isim alanlarını doldurun');
      return;
    }

    setSaving(true);
    try {
      const componentData = {
        organization_id: null,
        code: formData.code,
        name: formData.name,
        order_index: formData.order_index,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('ic_components')
          .update(componentData)
          .eq('id', editingItem.id);

        if (error) throw error;
        alert('Bileşen başarıyla güncellendi');
      } else {
        const { error } = await supabase
          .from('ic_components')
          .insert(componentData);

        if (error) throw error;
        alert('Bileşen başarıyla eklendi');
      }

      setShowModal(false);
      setEditingItem(null);
      loadComponents();
    } catch (error: any) {
      console.error('Bileşen kaydedilirken hata:', error);
      alert(`Hata: ${error?.message || 'Bilinmeyen hata'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu bileşeni silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve bileşene bağlı tüm standartlar da silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_components')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Bileşen başarıyla silindi');
      loadComponents();
    } catch (error: any) {
      console.error('Bileşen silinirken hata:', error);
      alert(`Hata: ${error?.message || 'Bilinmeyen hata'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            İç Kontrol Bileşenleri
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Tüm belediyeler için geçerli olan iç kontrol bileşenlerini yönetin
          </p>
        </div>
        <Button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Bileşen Ekle
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Sıra
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Kod
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Bileşen Adı
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {components.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  Henüz bileşen eklenmemiş
                </td>
              </tr>
            ) : (
              components.map((component) => (
                <tr key={component.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {component.order_index}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {component.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {component.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(component)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                      title="Düzenle"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(component.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        title={editingItem ? 'Bileşen Düzenle' : 'Yeni Bileşen Ekle'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bileşen Kodu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Örn: KOS"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Kısa kod (örn: KOS, RD, KF)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bileşen Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Örn: KONTROL ORTAMI"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Bileşenin tam açıklaması</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sıra Numarası
            </label>
            <input
              type="number"
              value={formData.order_index}
              onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
            />
            <p className="text-xs text-slate-500 mt-1">Bileşenlerin görüntülenme sırası</p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              onClick={() => {
                setShowModal(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              disabled={saving}
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
