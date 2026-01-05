import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Plus, ArrowLeft, Edit2, Trash2, FolderOpen } from 'lucide-react';

interface RiskCategory {
  id: string;
  organization_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  risk_count?: number;
}

export default function RiskCategories() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RiskCategory | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'EXTERNAL',
    description: '',
    color: '#6B7280',
    icon: 'AlertTriangle'
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadCategories();
    }
  }, [profile]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_categories')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('type')
        .order('code');

      if (error) throw error;

      const categoriesWithCount = await Promise.all(
        (data || []).map(async (category) => {
          const { count } = await supabase
            .from('risks')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id)
            .eq('is_active', true);

          return {
            ...category,
            risk_count: count || 0
          };
        })
      );

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('risk_categories')
          .update(formData)
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_categories')
          .insert({
            organization_id: profile?.organization_id,
            ...formData
          });

        if (error) throw error;
      }

      setShowAddModal(false);
      setEditingCategory(null);
      setFormData({
        code: '',
        name: '',
        type: 'EXTERNAL',
        description: '',
        color: '#6B7280',
        icon: 'AlertTriangle'
      });
      loadCategories();
    } catch (error: any) {
      console.error('Kategori kaydedilirken hata:', error);
      if (error.code === '23505') {
        alert('Bu kod zaten kullanılmaktadır');
      } else {
        alert('Kategori kaydedilemedi');
      }
    }
  };

  const handleEdit = (category: RiskCategory) => {
    setEditingCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      type: category.type,
      description: category.description || '',
      color: category.color,
      icon: category.icon || 'AlertTriangle'
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      loadCategories();
    } catch (error) {
      console.error('Kategori silinirken hata:', error);
      alert('Kategori silinemedi');
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'EXTERNAL' ? 'Dış Risk' : 'İç Risk';
  };

  const getTypeBadge = (type: string) => {
    return type === 'EXTERNAL'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  const externalCategories = categories.filter(c => c.type === 'EXTERNAL');
  const internalCategories = categories.filter(c => c.type === 'INTERNAL');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('risks')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Risk Kategorileri</h1>
            <p className="text-slate-600">Risk sınıflandırma yapısını yönetin</p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingCategory(null);
            setFormData({
              code: '',
              name: '',
              type: 'EXTERNAL',
              description: '',
              color: '#6B7280',
              icon: 'AlertTriangle'
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Kategori
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-purple-600 rounded"></div>
            <h2 className="text-lg font-semibold text-slate-900">Dış Riskler</h2>
            <span className="text-sm text-slate-500">({externalCategories.length})</span>
          </div>

          {externalCategories.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-slate-500">Henüz dış risk kategorisi yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {externalCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color + '20' }}
                        >
                          <FolderOpen className="w-5 h-5" style={{ color: category.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{category.code}</div>
                          <div className="text-sm text-slate-600">{category.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                    {category.description && (
                      <p className="text-sm text-slate-500 mb-2 ml-13">{category.description}</p>
                    )}
                    <div className="flex items-center justify-between ml-13">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(category.type)}`}>
                        {getTypeLabel(category.type)}
                      </span>
                      <span className="text-sm text-slate-500">{category.risk_count} Risk</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-blue-600 rounded"></div>
            <h2 className="text-lg font-semibold text-slate-900">İç Riskler</h2>
            <span className="text-sm text-slate-500">({internalCategories.length})</span>
          </div>

          {internalCategories.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-slate-500">Henüz iç risk kategorisi yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {internalCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color + '20' }}
                        >
                          <FolderOpen className="w-5 h-5" style={{ color: category.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{category.code}</div>
                          <div className="text-sm text-slate-600">{category.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                    {category.description && (
                      <p className="text-sm text-slate-500 mb-2 ml-13">{category.description}</p>
                    )}
                    <div className="flex items-center justify-between ml-13">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(category.type)}`}>
                        {getTypeLabel(category.type)}
                      </span>
                      <span className="text-sm text-slate-500">{category.risk_count} Risk</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="EXT-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tip</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="EXTERNAL">Dış Risk</option>
                    <option value="INTERNAL">İç Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori Adı</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Stratejik Riskler"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Kategori açıklaması..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Renk</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCategory ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
