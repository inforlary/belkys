import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  MoreVertical,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

interface RiskCategory {
  id: string;
  organization_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  type: 'EXTERNAL' | 'INTERNAL' | null;
  description: string | null;
  color: string | null;
  icon: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  risk_count?: number;
}

interface CategoryFormData {
  parent_id: string | null;
  code: string;
  name: string;
  description: string;
  type: 'EXTERNAL' | 'INTERNAL' | null;
  order_index: number;
  is_active: boolean;
}

export default function RiskCategories() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RiskCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RiskCategory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<RiskCategory | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<CategoryFormData>({
    parent_id: null,
    code: '',
    name: '',
    description: '',
    type: null,
    order_index: 0,
    is_active: true
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadCategories();
    }
  }, [profile?.organization_id]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      if (!profile?.organization_id) return;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('risk_categories')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('order_index');

      if (categoriesError) throw categoriesError;

      if (!categoriesData || categoriesData.length === 0) {
        await supabase.rpc('initialize_default_risk_categories', {
          org_id: profile.organization_id
        });

        const { data: newCategoriesData } = await supabase
          .from('risk_categories')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('order_index');

        if (newCategoriesData) {
          setCategories(newCategoriesData);
        }
      } else {
        const { data: riskCounts } = await supabase
          .from('risks')
          .select('category_id')
          .eq('organization_id', profile.organization_id);

        const countMap: Record<string, number> = {};
        riskCounts?.forEach((risk) => {
          if (risk.category_id) {
            countMap[risk.category_id] = (countMap[risk.category_id] || 0) + 1;
          }
        });

        const categoriesWithCounts = categoriesData.map((cat) => ({
          ...cat,
          risk_count: countMap[cat.id] || 0
        }));

        setCategories(categoriesWithCounts);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setMessage({ type: 'error', text: 'Kategoriler yüklenirken hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category?: RiskCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        parent_id: category.parent_id,
        code: category.code,
        name: category.name,
        description: category.description || '',
        type: category.type,
        order_index: category.order_index,
        is_active: category.is_active
      });
    } else {
      setEditingCategory(null);
      setFormData({
        parent_id: null,
        code: '',
        name: '',
        description: '',
        type: null,
        order_index: 0,
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      parent_id: null,
      code: '',
      name: '',
      description: '',
      type: null,
      order_index: 0,
      is_active: true
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!profile?.organization_id) return;
      if (!formData.code || !formData.name) {
        setMessage({ type: 'error', text: 'Kod ve ad alanları zorunludur' });
        return;
      }

      const dataToSave = {
        ...formData,
        organization_id: profile.organization_id,
        updated_at: new Date().toISOString()
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('risk_categories')
          .update(dataToSave)
          .eq('id', editingCategory.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Kategori başarıyla güncellendi' });
      } else {
        const { error } = await supabase
          .from('risk_categories')
          .insert([dataToSave]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Kategori başarıyla oluşturuldu' });
      }

      await loadCategories();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving category:', error);
      setMessage({ type: 'error', text: 'Kaydetme sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (category: RiskCategory) => {
    const hasChildren = categories.some((c) => c.parent_id === category.id);
    if (hasChildren) {
      setMessage({
        type: 'error',
        text: 'Bu kategorinin alt kategorileri var. Önce onları silin.'
      });
      return;
    }

    if (category.risk_count && category.risk_count > 0) {
      setMessage({
        type: 'error',
        text: `Bu kategoriye bağlı ${category.risk_count} risk var. Önce riskleri başka kategoriye taşıyın.`
      });
      return;
    }

    setCategoryToDelete(category);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('risk_categories')
        .delete()
        .eq('id', categoryToDelete.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Kategori başarıyla silindi' });
      await loadCategories();
      if (selectedCategory?.id === categoryToDelete.id) {
        setSelectedCategory(null);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      setMessage({ type: 'error', text: 'Silme sırasında hata oluştu' });
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
    }
  };

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const parentCategories = categories.filter((c) => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  const getRiskLevelEmoji = (score: number) => {
    if (score >= 20) return '⬛';
    if (score >= 15) return '🔴';
    if (score >= 10) return '🟠';
    if (score >= 5) return '🟡';
    return '🟢';
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Kategorileri</h1>
          <p className="mt-2 text-gray-600">İç ve dış risk kategorilerini yönetin</p>
        </div>
        {isAdmin && (
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yeni Kategori
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-4 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Kategoriler</h2>
          <div className="space-y-2">
            {parentCategories.map((parent) => {
              const children = getChildren(parent.id);
              const isExpanded = expandedCategories.has(parent.id);

              return (
                <div key={parent.id} className="space-y-1">
                  <div
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedCategory?.id === parent.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(parent.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div
                      onClick={() => setSelectedCategory(parent)}
                      className="flex-1 flex items-center gap-2"
                    >
                      <span className="font-medium">{parent.name}</span>
                    </div>
                    {isAdmin && (
                      <div className="relative group">
                        <button className="p-1 hover:bg-gray-200 rounded">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10">
                          <button
                            onClick={() => handleOpenModal(parent)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteClick(parent)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Sil
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="ml-6 space-y-1">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedCategory?.id === child.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            onClick={() => setSelectedCategory(child)}
                            className="flex-1 flex items-center gap-2"
                          >
                            <span className="text-sm">{child.name}</span>
                            {child.risk_count !== undefined && child.risk_count > 0 && (
                              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                                {child.risk_count}
                              </span>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="relative group">
                              <button className="p-1 hover:bg-gray-200 rounded">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10">
                                <button
                                  onClick={() => handleOpenModal(child)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Düzenle
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(child)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Sil
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          {selectedCategory ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCategory.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedCategory.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedCategory.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {selectedCategory.is_active ? 'Aktif ✓' : 'Pasif'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Üst Kategori:</div>
                  <div className="font-medium text-gray-900">
                    {selectedCategory.parent_id
                      ? categories.find((c) => c.id === selectedCategory.parent_id)?.name ||
                        'Bulunamadı'
                      : 'Ana Kategori'}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 mb-1">Risk Sayısı:</div>
                  <div className="font-medium text-gray-900">
                    {selectedCategory.risk_count || 0}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-sm text-gray-600 mb-1">Açıklama:</div>
                  <div className="text-gray-900">
                    {selectedCategory.description || (
                      <span className="text-gray-500 italic">Açıklama bulunmuyor</span>
                    )}
                  </div>
                </div>
              </div>

              {selectedCategory.risk_count && selectedCategory.risk_count > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Bu Kategorideki Riskler
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                      Bu kategoriye bağlı {selectedCategory.risk_count} risk bulunmaktadır. Riskleri
                      görüntülemek için Risk Listesi sayfasını ziyaret edin.
                    </p>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleOpenModal(selectedCategory)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDeleteClick(selectedCategory)}
                    className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Sil
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Bir kategori seçin
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Üst Kategori
                </label>
                <select
                  value={formData.parent_id || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, parent_id: e.target.value || null })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={
                    editingCategory
                      ? categories.some((c) => c.parent_id === editingCategory.id)
                      : false
                  }
                >
                  <option value="">Yok (Ana Kategori)</option>
                  {parentCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori Kodu *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="IC-FIN"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori Adı *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Finansal Riskler"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mali kaynaklarla ilgili riskler"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sıralama</label>
                <input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) =>
                    setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Aktif
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseModal}
                disabled={saving}
                className="flex-1 btn-secondary"
              >
                İptal
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && categoryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Kategoriyi Sil</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Bu işlem geri alınamaz
                </p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              <span className="font-medium">{categoryToDelete.name}</span> kategorisini silmek
              istediğinize emin misiniz?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCategoryToDelete(null);
                }}
                disabled={saving}
                className="flex-1 btn-secondary"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                {saving ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
