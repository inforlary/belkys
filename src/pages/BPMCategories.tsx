import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Save, X, Palette, Package } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import * as Icons from 'lucide-react';

interface Category {
  id: string;
  code: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  sort_order: number;
}

const iconList = [
  'Folder', 'FileText', 'Target', 'Package', 'Activity', 'Briefcase',
  'Settings', 'Users', 'TrendingUp', 'Shield', 'Award', 'Layers',
  'Grid', 'List', 'GitBranch', 'Database', 'Server', 'Cloud'
];

export default function BPMCategories() {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    color: '#3b82f6',
    icon: 'folder',
    description: '',
    sort_order: 0
  });

  useEffect(() => {
    console.log('BPMCategories mounted. User:', user?.id, 'Profile:', profile);
    console.log('User role:', profile?.role);
    console.log('Organization ID:', profile?.organization_id);
    if (profile?.organization_id) {
      fetchCategories();
    }
  }, [profile]);

  const fetchCategories = async () => {
    try {
      console.log('Fetching categories for organization:', profile?.organization_id);
      const { data, error } = await supabase
        .from('bpm_categories')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('sort_order', { ascending: true });

      console.log('Fetch categories result:', { data, error });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert(`Kategoriler yüklenirken hata: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('bpm_categories')
          .update({
            ...formData,
            code: formData.code.toUpperCase(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCategory.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        console.log('Inserting category with data:', {
          ...formData,
          code: formData.code.toUpperCase(),
          organization_id: profile?.organization_id,
          created_by: user?.id
        });

        const { data, error } = await supabase
          .from('bpm_categories')
          .insert({
            ...formData,
            code: formData.code.toUpperCase(),
            organization_id: profile?.organization_id,
            created_by: user?.id
          })
          .select();

        console.log('Insert result:', { data, error });

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      setShowModal(false);
      setEditingCategory(null);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(`Kategori kaydedilirken hata oluştu: ${error.message || 'Bilinmeyen hata'}\n\nDetay: ${JSON.stringify(error, null, 2)}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('bpm_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.message);
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const index = categories.findIndex(c => c.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === categories.length - 1)
    ) {
      return;
    }

    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];

    try {
      const updates = newCategories.map((cat, idx) => ({
        id: cat.id,
        sort_order: idx
      }));

      for (const update of updates) {
        await supabase
          .from('bpm_categories')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      fetchCategories();
    } catch (error) {
      console.error('Error reordering categories:', error);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      color: category.color,
      icon: category.icon,
      description: category.description || '',
      sort_order: category.sort_order
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingCategory(null);
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      color: '#3b82f6',
      icon: 'folder',
      description: '',
      sort_order: categories.length
    });
  };

  const seedDefaultCategories = async () => {
    if (!confirm('Varsayılan kategorileri yüklemek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase.rpc('seed_default_bpm_categories', {
        p_organization_id: profile?.organization_id
      });

      if (error) throw error;
      fetchCategories();
    } catch (error) {
      console.error('Error seeding categories:', error);
    }
  };

  const getIconComponent = (iconName: string) => {
    const capitalizedIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
    const IconComponent = Icons[capitalizedIconName as keyof typeof Icons] || Icons.Folder;
    return IconComponent;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kategori Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Süreç kategorilerini yönetin
          </p>
        </div>
        <div className="flex gap-3">
          {categories.length === 0 && (
            <Button onClick={seedDefaultCategories} variant="outline">
              <Package className="w-4 h-4 mr-2" />
              Varsayılan Kategorileri Yükle
            </Button>
          )}
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kategori
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Kategori Yok</h3>
          <p className="mt-1 text-sm text-gray-500">
            Başlamak için yeni bir kategori ekleyin veya varsayılan kategorileri yükleyin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category, index) => {
            const IconComponent = getIconComponent(category.icon);
            return (
              <div
                key={category.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                style={{ borderLeft: `4px solid ${category.color}` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      <IconComponent
                        className="w-6 h-6"
                        style={{ color: category.color }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-500">
                          {category.code}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMove(category.id, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(category.id, 'down')}
                      disabled={index === categories.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {category.description && (
                  <p className="mt-3 text-sm text-gray-600">{category.description}</p>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingCategory(null);
          resetForm();
        }}
        title={editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori Kodu (3 karakter)
            </label>
            <input
              type="text"
              maxLength={3}
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori Adı
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Renk
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              İkon
            </label>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {iconList.map((iconName) => {
                const IconComponent = getIconComponent(iconName);
                const isSelected = formData.icon === iconName.toLowerCase();
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: iconName.toLowerCase() })}
                    className={`p-3 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <IconComponent className="w-5 h-5 mx-auto" style={{ color: formData.color }} />
                  </button>
                );
              })}
            </div>
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
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingCategory(null);
                resetForm();
              }}
            >
              <X className="w-4 h-4 mr-2" />
              İptal
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}